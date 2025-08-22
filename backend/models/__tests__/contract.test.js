const test = require('node:test');
const assert = require('node:assert');

const { createContractItem } = require('../contract');

test('preserves required fields', () => {
  const input = {
    id: '123',
    producerId: 'producer1',
    type: 'fruit',
    variety: 'apple',
    category: 'fresh',
    amountNeeded: 100,
    dateNeeded: '2024-01-01T00:00:00.000Z',
    pingRate: 'daily',
    status: 'closed',
    progressUpdates: [{ progress: '50%', updateTime: '2024-01-02T00:00:00.000Z' }]
  };

  const item = createContractItem(input);

  assert.deepStrictEqual(item, input);
});

test('defaults status and progressUpdates', () => {
  const input = {
    id: '456',
    producerId: 'producer2',
    type: 'grain',
    variety: 'wheat',
    category: 'dry',
    amountNeeded: 200,
    dateNeeded: '2025-01-01T00:00:00.000Z',
    pingRate: 'weekly'
  };

  const item = createContractItem(input);

  assert.strictEqual(item.status, 'open');
  assert.deepStrictEqual(item.progressUpdates, []);
});
