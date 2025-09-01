const test = require('node:test');
const assert = require('node:assert');
const express = require('express');
const marketplaceRoutes = require('../../marketplace/marketplace_routes');
const docClient = require('../../lib/dynamodbClient');

test('POST /listings creates service listing with limited media', async () => {
  let putCalled = false;
  docClient.put = () => ({ promise: async () => { putCalled = true; } });
  docClient.scan = () => ({ promise: async () => ({ Items: [] }) });

  const app = express();
  app.use('/', marketplaceRoutes);
  const route = app.routes.find(r => r.method === 'post' && r.path === '/listings');

  const req = {
    body: {
      t: 'Soil Planning',
      c: 'la-pa',
      d: 'Plan your soil',
      term: 50,
      med: ['1','2','3','4','5','6']
    }
  };
  let status = 200;
  let body;
  const res = {
    status(code) { status = code; return this; },
    json(payload) { body = payload; }
  };

  await route.handler(req, res);

  assert.strictEqual(status, 201);
  assert.strictEqual(body.listing.media.length, 5);
  assert.ok(body.listing.tags.includes('la-pa'));
  assert.ok(putCalled);
});
