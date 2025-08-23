const { processCommand } = require('../broadcast/commandProcessor');
const subscriberManager = require('../broadcast/subscriberManager');

describe('mbr command', () => {
  test('broadcasts to subscribers with translation', () => {
    subscriberManager.addSubscriber('sub1', { language: 'es' });
    const result = processCommand({
      command: 'mbr',
      message: { content: 'Market update', priority: 1 }
    });
    expect(result.deliveries).toEqual([
      { subscriber: 'sub1', content: 'Actualización del mercado' }
    ]);
  });
});
