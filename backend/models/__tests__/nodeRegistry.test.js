const test = require('node:test');
const assert = require('node:assert');

const { NODE_REGISTRY_TABLE_NAME, createNodeRegistryItem } = require('../../federation/models/nodeRegistry');

test('NODE_REGISTRY_TABLE_NAME equals "NodeRegistry"', () => {
  assert.strictEqual(NODE_REGISTRY_TABLE_NAME, 'NodeRegistry');
});

test('createNodeRegistryItem returns object with url, region, contact, default lastSyncAt null', () => {
  const params = {
    url: 'https://node.example.com',
    region: 'us-east-1',
    contact: 'admin@example.com'
  };
  const item = createNodeRegistryItem(params);
  assert.deepStrictEqual(item, { ...params, lastSyncAt: null });
});

test('createNodeRegistryItem preserves provided lastSyncAt ISO string', () => {
  const isoString = new Date().toISOString();
  const params = {
    url: 'https://node.example.com',
    region: 'us-east-1',
    contact: 'admin@example.com',
    lastSyncAt: isoString
  };
  const item = createNodeRegistryItem(params);
  assert.strictEqual(item.lastSyncAt, isoString);
});
