const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const express = require('../../backend/node_modules/express');
const bcrypt = require('../../backend/utils/bcrypt');
const db = require('../../backend/lib/dynamodbClient');

test('host hands a backend login JWT to the exported chat account adapter', async t => {
  const original = { scan: db.scan, secret: process.env.JWT_SECRET, base: process.env.VITE_API_BASE_URL };
  process.env.JWT_SECRET = 'host-handoff-test-secret';
  const password = await bcrypt.hash('local-fixture-password', 10);
  db.scan = ({ TableName, ExpressionAttributeValues }) => ({ promise: async () => ({
    Items: TableName === 'Users'
      ? [{ id: 'alice', email: 'alice@example.test', password, role: 'consumer' }]
      : [{ id: 'owned-chat', ownerId: ExpressionAttributeValues[':ownerId'], title: 'Private chat' }],
  }) });
  const app = express();
  app.use(express.json());
  app.use('/api/auth', require('../../backend/routes/authRoutes'));
  app.use('/conversations', require('../../backend/routes/conversationRoutes'));
  const http = app.listen(0, '127.0.0.1');
  t.after(async () => {
    http.closeAllConnections();
    await new Promise(resolve => http.close(resolve));
    db.scan = original.scan;
    for (const [name, value] of [['JWT_SECRET', original.secret], ['VITE_API_BASE_URL', original.base]]) {
      if (value === undefined) delete process.env[name]; else process.env[name] = value;
    }
  });
  await once(http, 'listening');
  const base = `http://127.0.0.1:${http.address().port}`;
  process.env.VITE_API_BASE_URL = base;
  const { createServer } = await import('vite');
  const vite = await createServer({
    server: { middlewareMode: true, hmr: false, ws: false },
    optimizeDeps: { noDiscovery: true, include: [] }, appType: 'custom',
  });
  t.after(() => vite.close());
  const { accountClient, setAccountToken, get } = await vite.ssrLoadModule('/src/api.js');
  t.after(() => setAccountToken(null));
  const login = await fetch(base + '/api/auth/login', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'alice@example.test', password: 'local-fixture-password' }),
  });
  assert.equal(login.status, 200);
  const { token } = await login.json();
  setAccountToken(token);
  assert.deepEqual(await get('/conversations'), [{ id: 'owned-chat', ownerId: 'alice', title: 'Private chat' }]);
  setAccountToken(token);
  assert.equal(accountClient.getToken(), token);
  setAccountToken('rejected-token');
  await assert.rejects(get('/conversations'), error => error.status === 401);
  assert.equal(accountClient.getToken(), null, 'a rejected credential returns the UI to its sign-in state');
});
