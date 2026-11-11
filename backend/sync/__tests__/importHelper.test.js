const { test } = require('node:test');
const assert = require('node:assert/strict');
const docClient = require('../../lib/dynamodbClient');
const { importFederatedData, sanitizeImportedUser } = require('../importHelper');

test('empty federation import succeeds without writes', async () => {
  docClient.put = () => { throw new Error('unexpected write'); };
  assert.deepEqual(await importFederatedData({}), { success: true });
});

test('import requires source identity established by peer authentication', async () => {
  assert.throws(() => sanitizeImportedUser({ id: 'remote-1', username: 'alice' }), /source identity/);
});

test('import strips account authority and preserves authenticated provenance', async () => {
  const item = sanitizeImportedUser({
    id: 'remote-1', username: 'alice', password: 'hash', verificationCode: 'secret',
    verified: true, role: 'admin', email: 'a@example.test', phone: '555-0100',
    coordinates: { lat: 1, long: 2 }, sourceNodeId: 'forged-node',
    originNodeId: 'origin-node', originUserId: 'origin-user',
    arbitrarySecret: 'must-not-survive', reputationScore: 8
  }, 'authenticated-peer');

  assert.deepEqual(item, {
    id: 'remote-1', username: 'alice', reputationScore: 8,
    sourceNodeId: 'authenticated-peer', remoteUserId: 'remote-1',
    originNodeId: 'origin-node', originUserId: 'origin-user'
  });
});

test('conditional user create refuses collisions without a pre-read race', async () => {
  const writes = [];
  docClient.put = params => ({
    promise: async () => {
      writes.push(params);
      throw Object.assign(new Error('collision'), { code: 'ConditionalCheckFailedException' });
    }
  });

  await assert.rejects(
    () => importFederatedData({
      users: [{ id: 'existing-id', username: 'alice', role: 'admin', password: 'stolen' }]
    }, { sourceNodeId: 'peer-1' }),
    error => error.code === 'ConditionalCheckFailedException'
  );
  assert.equal(writes.length, 1);
  assert.equal(writes[0].ConditionExpression, 'attribute_not_exists(#id)');
  assert.equal(writes[0].Item.sourceNodeId, 'peer-1');
  assert.equal(writes[0].Item.password, undefined);
});

test('federation import propagates storage errors', async () => {
  docClient.put = () => ({ promise: async () => { throw new Error('write failed'); } });
  await assert.rejects(importFederatedData({ users: [{ id: 'u3', username: 'bob' }] }, {
    sourceNodeId: 'peer-1'
  }), /write failed/);
});
