const { test } = require('node:test');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');
const { once } = require('node:events');
const { randomUUID, randomBytes } = require('node:crypto');
const path = require('node:path');
const jwt = require('jsonwebtoken');

test('separate stream servers share capacity across conversations and renewed tokens', {
  skip: !process.env.STREAM_LIMIT_REDIS_URL,
  timeout: 30000,
}, async t => {
  const redisUrl = new URL(process.env.STREAM_LIMIT_REDIS_URL);
  assert.ok(['127.0.0.1', 'localhost', '[::1]'].includes(redisUrl.hostname));
  const secret = randomBytes(32).toString('hex');
  const owner = randomUUID();
  const workers = [];
  const controllers = [];
  t.after(async () => {
    for (const controller of controllers) controller.abort();
    await Promise.all(workers.map(async child => {
      if (child.exitCode === null) {
        const exited = once(child, 'exit');
        child.kill();
        await exited;
      }
    }));
  });
  const source = `
    const Conversation = require('./models/conversation');
    Conversation.setDocClient({ get: ({ Key }) => ({ promise: async () => ({
      Item: { id: Key.id, ownerId: Key.id.split(':')[0] }
    }) }) });
    const { server } = require('./server');
    const redis = require('./middleware/rateLimit').getRedisClient();
    const listen = () => server.listen(0, '127.0.0.1', () => process.send(server.address().port));
    if (redis.status === 'ready') listen(); else redis.once('ready', listen);
  `;
  const ports = [];
  for (let i = 0; i < 2; i++) {
    const child = spawn(process.execPath, ['-e', source], {
      cwd: path.resolve(__dirname, '..'),
      env: { ...process.env, MINIMAL_SERVER: 'true', REDIS_URL: redisUrl.href,
        RATE_LIMIT_REDIS_REQUIRED: 'true', JWT_SECRET: secret },
      stdio: ['ignore', 'ignore', 'inherit', 'ipc'],
    });
    workers.push(child);
    ports.push((await once(child, 'message'))[0]);
  }
  async function open(server, conversation, userId = owner) {
    const controller = new AbortController();
    controllers.push(controller);
    const token = jwt.sign({ userId }, secret, { expiresIn: '1h', jwtid: randomUUID() });
    return fetch(`http://127.0.0.1:${ports[server]}/stream/${userId}:${conversation}`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.any([controller.signal, AbortSignal.timeout(10000)]),
    });
  }
  for (let i = 0; i < 5; i++) {
    const response = await open(i % 2, `room-${i}`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /text\/event-stream/);
  }
  const denied = await open(1, 'sixth');
  assert.equal(denied.status, 429, 'switching servers, conversations, or tokens must not reset capacity');
  await denied.arrayBuffer();
  assert.equal((await open(0, 'other-account', randomUUID())).status, 200);
  controllers[0].abort();
  // Disconnect cleanup crosses the HTTP and Redis boundaries asynchronously.
  let replacement;
  for (let attempt = 0; attempt < 20; attempt++) {
    replacement = await open(1, 'replacement');
    if (replacement.status === 200) break;
    assert.equal(replacement.status, 429);
    await replacement.arrayBuffer();
    await new Promise(resolve => setTimeout(resolve, 10));
  }
  assert.equal(replacement.status, 200, 'disconnect must free capacity on the other server');
});
