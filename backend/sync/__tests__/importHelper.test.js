const { test } = require('node:test');
const assert = require('node:assert/strict');
const docClient = require('../../lib/dynamodbClient');
const { importFederatedData } = require('../importHelper');

test('empty federation import succeeds without writes', async () => {
  docClient.put = () => { throw new Error('unexpected write'); };
  assert.deepEqual(await importFederatedData({}), { success: true });
});

test('federation import propagates storage errors', async () => {
  docClient.put = () => ({ promise: async () => { throw new Error('write failed'); } });
  await assert.rejects(importFederatedData({ users: [{ id: 'u1' }] }), /write failed/);
});
