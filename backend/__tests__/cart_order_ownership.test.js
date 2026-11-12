const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID, randomBytes } = require('node:crypto');
const express = require('express');
const request = require('supertest');
const jwt = require('../utils/jwt');
const auth = require('../middleware/authMiddleware');
const Cart = require('../models/cart');
const Order = require('../models/order');

const app = express();
app.use(express.json());
app.use(auth);
app.use('/cart', require('../routes/cartRoutes'));
app.use('/orders', require('../routes/orderRoutes'));

const originalSecret = process.env.JWT_SECRET;
const originalKey = process.env.API_KEY;
before(() => {
  process.env.JWT_SECRET = randomBytes(32).toString('hex');
  process.env.API_KEY = randomUUID();
});
after(() => {
  if (originalSecret === undefined) delete process.env.JWT_SECRET;
  else process.env.JWT_SECRET = originalSecret;
  if (originalKey === undefined) delete process.env.API_KEY;
  else process.env.API_KEY = originalKey;
});

const operations = [
  { name: 'read cart', method: 'get', path: id => `/cart/${id}`, status: 200 },
  { name: 'add item', method: 'post', path: id => `/cart/${id}`, status: 201 },
  { name: 'remove item', method: 'delete', path: id => `/cart/${id}/apple`, status: 200 },
  { name: 'clear cart', method: 'delete', path: id => `/cart/${id}`, status: 200 },
  { name: 'checkout', method: 'post', path: id => `/orders/${id}/checkout`, status: 201 },
  { name: 'read orders', method: 'get', path: id => `/orders/${id}`, status: 200 },
];

function seedOwner() {
  const owner = randomUUID();
  Cart.addItem(owner, { id: 'apple', name: 'Apple' });
  Order.createOrder(owner, [{ id: 'pear', name: 'Pear' }], {});
  return owner;
}

function bearer(payload) {
  return { Authorization: `Bearer ${jwt.sign(payload, process.env.JWT_SECRET)}` };
}

const deniedCallers = [
  { name: 'another member', headers: () => bearer({ userId: randomUUID() }), status: 403 },
  { name: 'another member with admin role', headers: () => bearer({ userId: randomUUID(), role: 'admin' }), status: 403 },
  { name: 'API key without member identity', headers: () => ({ 'x-api-key': process.env.API_KEY }), status: 403 },
  { name: 'signed token without member identity', headers: () => bearer({ role: 'user' }), status: 403 },
  { name: 'anonymous caller', headers: () => ({}), status: 403 },
  { name: 'invalid token', headers: () => ({ Authorization: 'Bearer invalid' }), status: 401 },
];

// Removing the owner check would expose data or mutate these real stores.
for (const operation of operations) {
  for (const caller of deniedCallers) {
    test(`${operation.name} denies ${caller.name} without changing owner data`, async () => {
      const owner = seedOwner();
      const previousCart = structuredClone(Cart.getCart(owner));
      const previousOrders = structuredClone(Order.listOrders(owner));
      const response = await request(app)[operation.method](operation.path(owner))
        .set(caller.headers())
        .send({ id: 'banana', userId: owner, deliveryMethod: 'delivery' });
      assert.equal(response.status, caller.status);
      assert.equal(typeof response.body.error, 'string');
      assert.deepEqual(Cart.getCart(owner), previousCart);
      assert.deepEqual(Order.listOrders(owner), previousOrders);
    });
  }
}

// Rejecting everyone would break the same-owner paths as well.
for (const operation of operations) {
  test(`${operation.name} preserves same-owner behavior`, async () => {
    const owner = seedOwner();
    const response = await request(app)[operation.method](operation.path(owner))
      .set(bearer({ userId: owner }))
      .send({ id: 'banana', deliveryMethod: 'delivery', deliveryAddress: 'Test address' });
    assert.equal(response.status, operation.status);
    const cart = Cart.getCart(owner);
    const orders = Order.listOrders(owner);
    switch (operation.name) {
      case 'read cart':
        assert.deepEqual(response.body, [{ id: 'apple', name: 'Apple' }]);
        break;
      case 'add item':
        assert.deepEqual(cart.map(item => item.id), ['apple', 'banana']);
        break;
      case 'read orders':
        assert.equal(response.body.length, 1);
        assert.equal(response.body[0].userId, owner);
        assert.deepEqual(response.body[0].items, [{ id: 'pear', name: 'Pear' }]);
        break;
      case 'checkout':
        assert.equal(response.body.userId, owner);
        assert.deepEqual(response.body.items, [{ id: 'apple', name: 'Apple' }]);
        assert.equal(response.body.deliveryMethod, 'delivery');
        assert.equal(response.body.deliveryAddress, 'Test address');
        assert.equal(orders.length, 2);
        assert.deepEqual(cart, []);
        break;
      default:
        assert.deepEqual(cart, []);
    }
  });
}
