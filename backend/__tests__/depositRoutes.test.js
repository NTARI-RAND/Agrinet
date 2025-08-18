const { test } = require('node:test');
const assert = require('node:assert');
const { createRes } = require('./testUtils');
const depositController = require('../controllers/deposit_controller');

const calls = [];
depositController.getOrCreateAccount = async () => { calls.push('get'); };
depositController.fundAccount = async () => { calls.push('fund'); };
depositController.withdrawAccount = async () => { calls.push('withdraw'); };
depositController.getTransactionHistory = async () => { calls.push('history'); };

const router = require('../routes/depositRoutes');

test('router wires controller methods', async () => {
  const routes = router.routes;
  const req = { headers: { 'x-api-key': 'key' }, user: { id: 'u1' }, body: { amount: 1 } };
  const res = createRes();
  await routes.find(r => r.method === 'get' && r.path === '/').handler(req, res);
  await routes.find(r => r.method === 'post' && r.path === '/fund').handler(req, res);
  await routes.find(r => r.method === 'post' && r.path === '/withdraw').handler(req, res);
  await routes.find(r => r.method === 'get' && r.path === '/history').handler(req, res);
  assert.deepStrictEqual(calls, ['get', 'fund', 'withdraw', 'history']);
});

test('router registers auth middleware', () => {
  const first = router.routes[0];
  assert.strictEqual(first.method, 'use');
  assert.strictEqual(typeof first.handler, 'function');
});
