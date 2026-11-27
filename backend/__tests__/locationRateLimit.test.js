const request = require('supertest');
const http = require('node:http');
const jwt = require('jsonwebtoken');
const { rateLimit } = require('express-rate-limit');

jest.mock('../lib/dynamodbClient', () => ({
  get: ({ Key }) => ({ promise: async () => ({ Item: { id: Key.id, coordinates: { lat: 0, long: 0 }, privacy: false } }) }),
}));

describe('location request budgets', () => {
  let app, server, agent;
  const send = (method, url) => request(server)[method](url).agent(agent);
  const env = { ...process.env };
  const authorization = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' })}`;

  beforeAll(() => {
    process.env.JWT_SECRET = 'location-budget-test';
    process.env.API_KEY = 'location-budget-key';
  });
  beforeEach(async () => {
    jest.resetModules();
    const express = require('express');
    app = express();
    // Bound this test server too, while allowing the route's 1,000-request
    // budget and independent-account behavior to be exercised first.
    app.use(express.json(), rateLimit({ windowMs: 60 * 1000, limit: 10000 }), require('../middleware/authMiddleware'));
    app.use('/api/location', require('../routes/locationRoutes'));
    agent = new http.Agent({ keepAlive: true });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });
  afterEach(async () => {
    agent.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  afterAll(() => { process.env = env; });

  test('owner reads and writes share a budget without changing ownership denials', async () => {
    const token = authorization('alice');
    for (let i = 0; i < 1000; i++) {
      const method = i % 2 ? 'post' : 'get';
      const response = await send(method, '/api/location/foreign').set('Authorization', token);
      expect(response.status).toBe(403);
    }
    const blocked = await send('get', '/api/location/foreign').set('Authorization', authorization('alice'));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await send('post', '/api/location/foreign').set('Authorization', token)
      .set('X-Forwarded-For', '203.0.113.9')).status).toBe(429);
    expect((await send('get', '/api/location/foreign').set('Authorization', authorization('bob'))).status).toBe(403);
  }, 20000);

  test('API-key requests use an IP budget that cannot be reset by forwarded headers', async () => {
    for (let i = 0; i < 1000; i++) {
      expect((await send('get', '/api/location/foreign').set('x-api-key', process.env.API_KEY)).status).toBe(401);
    }
    const blocked = await send('get', '/api/location/foreign').set('x-api-key', process.env.API_KEY)
      .set('X-Forwarded-For', '203.0.113.10');
    expect(blocked.status).toBe(429);
    // Owner authentication accepts any nonempty string ID, including spaces.
    expect((await send('get', '/api/location/%20').set('Authorization', authorization(' '))).status).toBe(200);
  }, 20000);

  test('adding an API key cannot give an owner another account budget', async () => {
    const token = authorization('credential-owner');
    for (let i = 0; i < 1000; i++) {
      expect((await send('get', '/api/location/credential-owner').set('Authorization', token)).status).toBe(200);
    }
    for (const key of [process.env.API_KEY, 'invalid-key']) {
      expect((await send('get', '/api/location/credential-owner').set('Authorization', token)
        .set('x-api-key', key)).status).toBe(429);
    }
  }, 20000);
});
