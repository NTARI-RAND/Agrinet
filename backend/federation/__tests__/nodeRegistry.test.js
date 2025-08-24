const { createNodeRegistryItem } = require('../models/nodeRegistry');

describe('createNodeRegistryItem', () => {
  test('applies recursive template to fill defaults', () => {
    const node = createNodeRegistryItem({
      nodeId: 'node-1',
      url: 'https://node.example.org',
      region: 'global',
      contact: 'admin@example.org'
    });

    expect(node.nodeId).toBe('node-1');
    expect(node.production.capabilities).toEqual([]);
    expect(node.services.financial.marketListings).toEqual([]);
    expect(node.services.marketing.socialMediaSyndication).toEqual([]);
    expect(node.services.messaging.levesonRatings).toEqual([]);
    expect(node.support.environmentalServices).toEqual([]);
    expect(node.reputation.leveson).toBe(0);
  });
});
