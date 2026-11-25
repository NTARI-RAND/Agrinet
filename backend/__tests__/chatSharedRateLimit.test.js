const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID } = require('node:crypto');
const path = require('node:path');
const jwt = require('jsonwebtoken');

// Explicit integration run: CHAT_LIMIT_REDIS_URL must name disposable local Redis.
test('separate chat server processes share the verified account request budget', {
  skip: !process.env.CHAT_LIMIT_REDIS_URL,
  timeout: 30000,
}, async t => {
  const redisUrl = new URL(process.env.CHAT_LIMIT_REDIS_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(redisUrl.hostname));
  const secret = 'local-chat-limit-integration-secret';
  const account = randomUUID();
  const workers = [];
  t.after(async () => {
    await Promise.all(workers.map(async child => {
      if (child.exitCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }));
  });
  const source = `
    const express = require('express');
    const db = require('./lib/dynamodbClient');
    db.scan = () => ({ promise: async () => ({ Items: [] }) });
    const app = express();
    app.use('/conversations', require('./routes/conversationRoutes'));
    const redis = require('./middleware/rateLimit').getRedisClient();
    const listen = () => {
      const server = app.listen(0, '127.0.0.1', () => process.send(server.address().port));
    };
    if (redis.status === 'ready') listen(); else redis.once('ready', listen);
  `;
  const ports = [];
  for (let i = 0; i < 2; i++) {
    const child = spawn(process.execPath, ['-e', source], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, REDIS_URL: redisUrl.href, RATE_LIMIT_REDIS_REQUIRED: 'true', JWT_SECRET: secret },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    workers.push(child);
    ports.push((await once(child, 'message'))[0]);
  }
  async function read(index, userId = account) {
    const token = jwt.sign({ userId }, secret, { expiresIn: '1h', jwtid: randomUUID() });
    return fetch(`http://127.0.0.1:${ports[index]}/conversations`, {
      headers: { Authorization: `Bearer ${token}` },
    });
  }
  for (let i = 0; i < 120; i++) {
    const response = await read(i % 2);
    assert.equal(response.status, 200, `request ${i + 1}`);
    assert.deepEqual(await response.json(), []);
  }
  const denied = await read(0);
  assert.equal(denied.status, 429, 'renewing tokens or switching servers must not reset the account budget');
  assert.ok(Number(denied.headers.get('retry-after')) > 0);
  assert.equal((await read(1, randomUUID())).status, 200, 'another account retains its own budget');
});
