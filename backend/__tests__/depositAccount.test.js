const { test } = require('node:test');
const assert = require('node:assert');
const { createDepositAccountItem } = require('../models/depositAccount');

test('createDepositAccountItem returns defaults', () => {
  const item = createDepositAccountItem({ userId: 'u1' });
  assert.deepStrictEqual(item, {
    userId: 'u1',
    balance: 0,
    currency: 'USD',
    transactionHistory: []
  });
});
