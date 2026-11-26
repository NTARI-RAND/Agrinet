const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const marketplaceRoutes = require('../../marketplace/marketplace_routes');
const docClient = require('../../lib/dynamodbClient');
const jwt = require('../../utils/jwt');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'listings-test-secret';
const bearer = (userId) => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET)}`;

test('POST /listings creates service listing with limited media', async () => {
  let putCalled = false;
  docClient.put = () => ({ promise: async () => { putCalled = true; } });
  docClient.scan = () => ({ promise: async () => ({ Items: [] }) });

  const app = express();
  app.use(express.json());
  app.use('/', marketplaceRoutes);

  const req = {
    body: {
      t: 'Soil Planning',
      c: 'la-pa',
      d: 'Plan your soil',
      term: 50,
      med: ['1','2','3','4','5','6']
    }
  };
  const { status, body } = await request(app).post('/listings')
    .set('Authorization', bearer('farmer-1')).send({ ...req.body, userId: 'someone-else' });

  assert.strictEqual(status, 201);
  assert.strictEqual(body.listing.media.length, 5);
  assert.ok(body.listing.tags.includes('la-pa'));
  assert.strictEqual(body.listing.userId, 'farmer-1');
  assert.ok(putCalled);
});

test('POST /listings needs a signed-in account', async () => {
  let putCalled = false;
  docClient.put = () => ({ promise: async () => { putCalled = true; } });
  const app = express();
  app.use(express.json());
  app.use('/', marketplaceRoutes);

  const { status } = await request(app).post('/listings')
    .send({ t: 'Soil Planning', c: 'la-pa', d: 'Plan your soil', userId: 'farmer-1' });

  assert.strictEqual(status, 401);
  assert.strictEqual(putCalled, false);
});
