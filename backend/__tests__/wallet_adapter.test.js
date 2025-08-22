const { test } = require('node:test');
const assert = require('node:assert');
const adapter = require('../controllers/wallet_adapter');
const docClient = require('../lib/dynamodbClient');
const { createRes } = require('./testUtils');

test('manualWalletCredit records deposit', async () => {
  let updateParams;
  docClient.update = params => {
    updateParams = params;
    return { promise: async () => ({ Attributes: { balance: 100 } }) };
  };
  const req = { body: { walletAddress: 'wa', userId: 'u1', amount: 50, txHash: 'hash' } };
  const res = createRes();
  await adapter.manualWalletCredit(req, res);
  assert.strictEqual(res.body.newBalance, 100);
  assert.strictEqual(updateParams.ExpressionAttributeValues[':amount'], 50);
});
