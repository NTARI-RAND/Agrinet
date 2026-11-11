const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const depositController = require('../controllers/deposit_controller');

for (const method of ['getOrCreateAccount', 'fundAccount', 'withdrawAccount', 'getTransactionHistory']) {
  depositController[method] = async (_req, res) => res.json({ method });
}
const app = express();
app.use(require('../routes/depositRoutes'));

test('deposit routes dispatch authenticated requests to their controllers', async (t) => {
  const originalKey = process.env.API_KEY;
  process.env.API_KEY = 'test-deposit-key';
  t.after(() => {
    if (originalKey === undefined) delete process.env.API_KEY;
    else process.env.API_KEY = originalKey;
  });
  for (const [verb, path, method] of [
    ['get', '/', 'getOrCreateAccount'], ['post', '/fund', 'fundAccount'],
    ['post', '/withdraw', 'withdrawAccount'], ['get', '/history', 'getTransactionHistory'],
  ]) {
    const response = await request(app)[verb](path).set('x-api-key', process.env.API_KEY);
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, { method });
  }
});

test('deposit routes reject unauthenticated requests', async () => {
  assert.equal((await request(app).get('/')).status, 403);
});
