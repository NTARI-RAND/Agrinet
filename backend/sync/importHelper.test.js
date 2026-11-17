const { test } = require('node:test');
const assert = require('node:assert/strict');
const docClient = require('../lib/dynamodbClient');
const { importFederatedData } = require('./importHelper');

test('imports listings and transactions and conditionally creates sanitized federated users', async () => {
  const calls = [];
  docClient.put = params => ({ promise: async () => calls.push(params) });
  const data = {
    listings: [{ id: 'l1' }],
    transactions: [{ id: 't1' }],
    users: [{ id: 'u1', username: 'remote-user', password: 'must-not-import', role: 'admin', verified: true }]
  };
  await importFederatedData(data, { sourceNodeId: 'authenticated-peer' });
  assert.deepEqual(calls, [
    { TableName: 'Listings', Item: data.listings[0] },
    { TableName: 'Transactions', Item: data.transactions[0] },
    {
      TableName: 'Users',
      Item: {
        id: 'u1',
        username: 'remote-user',
        sourceNodeId: 'authenticated-peer',
        remoteUserId: 'u1',
        originNodeId: 'authenticated-peer',
        originUserId: 'u1'
      },
      ConditionExpression: 'attribute_not_exists(#id)',
      ExpressionAttributeNames: { '#id': 'id' }
    }
  ]);
});
