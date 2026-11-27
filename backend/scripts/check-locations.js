// Explicit integration check: node --test scripts/check-locations.js
// Requires a disposable DynamoDB Local endpoint; never accepts a remote host.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const endpoint = new URL(process.env.DYNAMODB_ENDPOINT || 'http://127.0.0.1:18001');
if (!['127.0.0.1', 'localhost', '[::1]'].includes(endpoint.hostname)) {
  throw new Error('Location check requires loopback DynamoDB Local');
}
process.env.DYNAMODB_ENDPOINT = endpoint.href;
process.env.AWS_ACCESS_KEY_ID = 'localcheck';
process.env.AWS_SECRET_ACCESS_KEY = 'localcheck';
process.env.AWS_REGION = 'us-east-1';
process.env.JWT_SECRET = 'location-integration-only';
process.env.API_KEY = 'location-integration-key';
process.env.LOCATION_TABLE_NAME = `LocationCheck-${randomUUID()}`;
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');
const admin = new DynamoDBClient({ region: 'us-east-1', endpoint: endpoint.href });
const db = require('../lib/dynamodbClient');
const jwt = require('jsonwebtoken');
const express = require('express');
const auth = require('../middleware/authMiddleware');
const app = express();
app.use(express.json(), require('../middleware/requestRateLimit')(), auth);
app.use('/api/location', require('../routes/locationRoutes'));
const body = (privacy = false, coordinates = 'geoLat_0.0,geoLong_0.0') => ({ coordinates, locationType: 'farm', privacy });

test('location persistence and discovery against DynamoDB Local', async t => {
  await admin.send(new CreateTableCommand({
    TableName: process.env.LOCATION_TABLE_NAME,
    KeySchema: [{ AttributeName: 'id', KeyType: 'HASH' }],
    AttributeDefinitions: [{ AttributeName: 'id', AttributeType: 'S' }],
    BillingMode: 'PAY_PER_REQUEST'
  }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${server.address().port}/api/location`;
  async function request(path, { owner, payload, token, key = false } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (owner) headers.Authorization = `Bearer ${jwt.sign({ userId: owner }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
    if (token) headers.Authorization = `Bearer ${token}`;
    if (key || !headers.Authorization) headers['x-api-key'] = process.env.API_KEY;
    const res = await fetch(base + path, { method: payload === undefined ? 'GET' : 'POST', headers,
      ...(payload === undefined ? {} : { body: JSON.stringify(payload) }) });
    return { status: res.status, body: await res.json(), cursor: res.headers.get('x-next-cursor'), cache: res.headers.get('cache-control'), exposed: res.headers.get('access-control-expose-headers') };
  }
  async function check(name, fn) { await fn(); t.diagnostic(name); }
  const search = '?lat=0&long=0&radius=1';
  try {
    await check('save writes durable data and owner can reload it', async () => {
      assert.equal((await request('/private', { owner: 'private', payload: body() })).status, 200);
      const item = await db.get({ TableName: process.env.LOCATION_TABLE_NAME, Key: { id: 'private' }, ConsistentRead: true }).promise();
      assert.deepEqual(item.Item?.coordinates, { lat: 0, long: 0 });
      const loaded = await request('/private', { owner: 'private' });
      assert.equal(loaded.status, 200);
      assert.equal(loaded.cache, 'no-store');
      assert.equal(loaded.body.privacy, false);
      assert.deepEqual(loaded.body.coordinates, { lat: 0, long: 0 });
    });
    await check('API keys and other accounts cannot read or mutate private locations', async () => {
      for (const options of [{}, { owner: 'other' }, { token: jwt.sign({ userId: 'private' }, 'wrong-secret') },
        { token: jwt.sign({ userId: 'private' }, process.env.JWT_SECRET, { expiresIn: -1 }) }]) {
        for (const payload of [undefined, body(true)]) {
          const res = await request('/private', { ...options, payload, key: true });
          assert.ok([401, 403].includes(res.status), JSON.stringify(res));
        }
      }
      assert.equal((await request('/private', { owner: 'private' })).body.privacy, false);
    });
    await check('explicit sharing discovers safe DTOs inside radius only; unsharing removes them', async () => {
      await request('/near', { owner: 'near', payload: body(true, 'geoLat_0.005,geoLong_0.0') });
      await request('/far', { owner: 'far', payload: body(true, 'geoLat_1.0,geoLong_0.0') });
      let found = await request('/' + search);
      assert.equal(found.status, 200);
      assert.deepEqual(found.body.map(x => x.id), ['near']);
      assert.deepEqual(Object.keys(found.body[0]).sort(), ['coordinates', 'id', 'locationType']);
      await request('/near', { owner: 'near', payload: body(false) });
      found = await request('/' + search);
      assert.deepEqual(found.body, []);
    });
    await check('invalid input cannot alter a saved location', async () => {
      for (const payload of [body('true'), { ...body(), privacy: undefined }, body(true, 'geoLat_91.0,geoLong_0.0'),
        body(true, 'geoLat_0.0,geoLong_181.0'), { ...body(), locationType: 'unknown' }, { ...body(), coordinates: 7 }]) {
        assert.equal((await request('/private', { owner: 'private', payload })).status, 400);
      }
      assert.equal((await request('/private', { owner: 'private' })).body.privacy, false);
      for (const query of ['lat=0junk&long=0&radius=1', 'lat=91&long=0&radius=1', 'lat=0&long=181&radius=1',
        'lat=0&long=0&radius=-1', 'lat=0&long=0&radius=Infinity', 'lat=&long=0&radius=1',
        'lat=0&long=0&radius=1&type=unknown', 'lat=0&lat=1&long=0&radius=1']) {
        assert.equal((await request('/?' + query)).status, 400, query);
      }
    });
    await check('coordinate boundaries and zero radius are supported', async () => {
      for (const [id, coordinates] of [['north', 'geoLat_90.0,geoLong_180.0'], ['south', 'geoLat_-90.0,geoLong_-180.0']]) {
        assert.equal((await request('/' + id, { owner: id, payload: body(true, coordinates) })).status, 200);
      }
      await request('/zero', { owner: 'zero', payload: body(true) });
      assert.deepEqual((await request('/?lat=0&long=0&radius=0&type=farm')).body.map(x => x.id), ['zero']);
      assert.equal((await request('/missing', { owner: 'missing' })).status, 404);
    });
    await check('bounded pages continue past private rows and cursors reject tampering or query changes', async () => {
      for (let i = 0; i < 120; i++) {
        await request(`/page-${i}`, { owner: `page-${i}`, payload: body(i % 2 === 0) });
      }
      let cursor, pages = 0;
      const ids = [];
      do {
        const result = await request('/' + search + (cursor ? '&cursor=' + encodeURIComponent(cursor) : ''));
        assert.equal(result.status, 200);
        assert.ok(result.body.length <= 100);
        assert.equal(result.exposed, 'X-Next-Cursor');
        ids.push(...result.body.map(x => x.id));
        cursor = result.cursor;
        if (cursor) {
          assert.equal((await request('/' + search + '&cursor=' + cursor.slice(0, -4) + 'xxxx')).status, 400);
          assert.equal((await request('/?lat=0&long=0&radius=2&cursor=' + cursor)).status, 400);
        }
        assert.ok(++pages < 10);
      } while (cursor);
      assert.ok(pages >= 2);
      assert.equal(new Set(ids).size, 61);
      assert.equal(ids.length, 61);
    });
    await check('empty private pages retain continuation without exposing private row data', async () => {
      const first = await db.scan({ TableName: process.env.LOCATION_TABLE_NAME, Limit: 100, ConsistentRead: true }).promise();
      assert.ok(first.LastEvaluatedKey);
      for (const item of first.Items) {
        await db.put({ TableName: process.env.LOCATION_TABLE_NAME, Item: { ...item, privacy: false } }).promise();
      }
      const empty = await request('/' + search);
      assert.deepEqual(empty.body, []);
      assert.ok(empty.cursor);
      assert.equal((await request('/' + search + '&cursor=' + empty.cursor)).status, 200);
    });
    await check('storage failure never reports saved or returns a successful empty discovery', async () => {
      await admin.send(new DeleteTableCommand({ TableName: process.env.LOCATION_TABLE_NAME }));
      assert.equal((await request('/private', { owner: 'private', payload: body() })).status, 500);
      assert.equal((await request('/' + search)).status, 500);
    });
    await check('the verification server bounds authentication attempts', async () => {
      let limited = false;
      for (let i = 0; i < 1001; i++) {
        const response = await fetch(base, { headers: { Authorization: 'Bearer invalid' } });
        await response.text();
        if (response.status === 429) {
          assert.ok(Number(response.headers.get('retry-after')) > 0);
          limited = true;
          break;
        }
        assert.equal(response.status, 401);
      }
      assert.ok(limited, 'authentication attempts must be rate limited');
    });
  } finally {
    await new Promise(resolve => server.close(resolve));
    await admin.send(new DeleteTableCommand({ TableName: process.env.LOCATION_TABLE_NAME })).catch(err => {
      if (err.name !== 'ResourceNotFoundException') throw err;
    });
    admin.destroy();
  }
});
