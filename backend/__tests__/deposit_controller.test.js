const { test } = require('node:test');
const assert = require('node:assert');
const controller = require('../controllers/deposit_controller');
const docClient = require('../lib/dynamodbClient');
const { createRes } = require('./testUtils');

test('getOrCreateAccount creates account when missing', async () => {
  docClient.get = () => ({ promise: async () => ({}) });
  let putCalled = false;
  docClient.put = params => ({ promise: async () => { putCalled = true; return {}; } });

  const req = { user: { id: 'user1' } };
  const res = createRes();
  await controller.getOrCreateAccount(req, res);
  assert.ok(putCalled);
  assert.strictEqual(res.body.userId, 'user1');
});

test('fundAccount increases balance', async () => {
  docClient.get = () => ({ promise: async () => ({ Item: { userId: 'user1', balance: 50 } }) });
  let updateParams;
  docClient.update = params => {
    updateParams = params;
    return { promise: async () => ({ Attributes: { balance: 150 } }) };
  };

  const req = { user: { id: 'user1' }, body: { amount: 100, note: 'test' } };
  const res = createRes();
  await controller.fundAccount(req, res);
  assert.strictEqual(res.body.newBalance, 150);
  assert.strictEqual(updateParams.ExpressionAttributeValues[':amount'], 100);
});

test('withdrawAccount returns error on insufficient funds', async () => {
  docClient.get = () => ({ promise: async () => ({ Item: { userId: 'user1', balance: 50 } }) });
  const req = { user: { id: 'user1' }, body: { amount: 100 } };
  const res = createRes();
  await controller.withdrawAccount(req, res);
  assert.strictEqual(res.statusCode, 400);
  assert.deepStrictEqual(res.body, { error: 'Insufficient funds' });
});

test('getTransactionHistory returns array', async () => {
  docClient.get = () => ({ promise: async () => ({ Item: { transactionHistory: [1, 2] } }) });
  const req = { user: { id: 'user1' } };
  const res = createRes();
  await controller.getTransactionHistory(req, res);
  assert.deepStrictEqual(res.body, [1, 2]);
});
