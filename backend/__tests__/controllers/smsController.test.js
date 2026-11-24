const assert = require('node:assert/strict');
const { test } = require('node:test');

test('PRICE queries with different whitespace look up the same multiword crop', async (t) => {
  const priceModule = require.resolve('../../models/agriInfo');
  const queueModule = require.resolve('../../bull/smsQueue');
  const controllerModule = require.resolve('../../controllers/smsController');
  const prices = { getPrice: async (crop) => (crop === 'sweet corn' ? '300' : null) };
  const queue = { enqueueSms: async () => {} };
  const getPrice = t.mock.method(prices, 'getPrice');
  const enqueueSms = t.mock.method(queue, 'enqueueSms');

  // Avoid opening a Redis worker or constructing a DynamoDB client.
  require.cache[priceModule] = { exports: prices };
  require.cache[queueModule] = { exports: queue };
  t.after(() => {
    delete require.cache[controllerModule];
    delete require.cache[priceModule];
    delete require.cache[queueModule];
  });

  const { handleIncomingSMS } = require(controllerModule);
  for (const body of ['PRICE Sweet Corn', '  PRICE   Sweet   Corn  ', 'PRICE\tSweet\tCorn']) {
    await t.test(JSON.stringify(body), async () => {
      getPrice.mock.resetCalls();
      enqueueSms.mock.resetCalls();

      const res = {
        status(code) {
          assert.equal(code, 200);
          return this;
        },
        send(message) {
          assert.equal(message, 'OK');
        },
      };
      await handleIncomingSMS({ body: { Body: body, From: '+15550100000' } }, res);

      assert.deepEqual(getPrice.mock.calls.map(({ arguments: args }) => args), [['sweet corn']]);
      assert.deepEqual(enqueueSms.mock.calls.map(({ arguments: args }) => args), [
        ['+15550100000', 'Current price of sweet corn: 300'],
      ]);
    });
  }
});
