const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const request = require('supertest');
const marketplaceRoutes = require('../../marketplace/marketplace_routes');
const docClient = require('../../lib/dynamodbClient');

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
  const { status, body } = await request(app).post('/listings').send(req.body);

  assert.strictEqual(status, 201);
  assert.strictEqual(body.listing.media.length, 5);
  assert.ok(body.listing.tags.includes('la-pa'));
  assert.ok(putCalled);
});
