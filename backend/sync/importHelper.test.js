const { test } = require('node:test');
const assert = require('node:assert/strict');
const docClient = require('../lib/dynamodbClient');
const { importFederatedData } = require('./importHelper');

test('imports listings, transactions, and users into their DynamoDB tables', async () => {
  const calls = [];
  docClient.put = (params) => ({ promise: async () => calls.push(params) });
  const data = { listings: [{ id: 'l1' }], transactions: [{ id: 't1' }], users: [{ id: 'u1' }] };
  await importFederatedData(data);
  assert.deepEqual(calls, [
    { TableName: 'Listings', Item: data.listings[0] },
    { TableName: 'Transactions', Item: data.transactions[0] },
    { TableName: 'Users', Item: data.users[0] },
  ]);
});
