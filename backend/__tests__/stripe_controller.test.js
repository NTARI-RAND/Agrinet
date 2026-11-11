const { test } = require('node:test');
const assert = require('node:assert');
const Stripe = require('stripe');
process.env.STRIPE_SECRET_KEY = 'sk_test_placeholder';
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
require.cache[require.resolve('stripe')].exports = function () { return stripe; };
const controller = require('../controllers/stripe_controller');
const docClient = require('../lib/dynamodbClient');
const { createRes } = require('./testUtils');

test('createCheckoutSession returns url', async () => {
  stripe.checkout.sessions.create = async () => ({ url: 'mock-url' });
  const req = { body: { amount: 5 }, user: { id: 'u1' } };
  const res = createRes();
  await controller.createCheckoutSession(req, res);
  assert.deepStrictEqual(res.body, { url: 'mock-url' });
});

test('handleWebhook updates deposit account', async () => {
  let updated = false;
  docClient.update = () => ({ promise: async () => { updated = true; } });
  stripe.webhooks.constructEvent = () => ({
      type: 'checkout.session.completed',
      data: { object: { metadata: { userId: 'u1', amount: '10' } } }
  });
  const req = { headers: { 'stripe-signature': 'sig' }, body: {} };
  const res = createRes();
  await controller.handleWebhook(req, res);
  assert.ok(updated);
  assert.deepStrictEqual(res.body, { received: true });
});
