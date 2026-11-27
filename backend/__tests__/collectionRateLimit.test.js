const request = require('supertest');
const http = require('node:http');
const jwt = require('jsonwebtoken');

jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());
jest.mock('../lib/dynamodbClient', () => ({
  get: ({ Key }) => ({ promise: async () => ({
    Item: Key.id === 'owned' ? { id: 'owned', ownerId: 'alice' } : undefined,
  }) }),
  query: () => ({ promise: async () => ({ Items: [] }) }),
  put: () => ({ promise: async () => ({}) }),
}));

describe('account collection request budgets', () => {
  let app, server, agent;
  const send = (method, url) => request(server)[method](url).agent(agent);
  const env = { ...process.env };
  const authorization = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '2h' })}`;
  beforeAll(() => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.JWT_SECRET = 'collection-budget-test';
    process.env.API_KEY = 'collection-budget-key';
  });
  beforeEach(async () => {
    jest.resetModules();
    ({ app } = require('../server'));
    agent = new http.Agent({ keepAlive: true });
    server = app.listen(0, '127.0.0.1');
    await new Promise(resolve => server.once('listening', resolve));
  });
  afterEach(async () => {
    agent.destroy();
    await new Promise(resolve => server.close(resolve));
  });
  afterAll(() => { process.env = env; });

  test('directory limits verified accounts independently when credentials change', async () => {
    const url = '/users?limit=0';
    const token = authorization('alice');
    for (let i = 0; i < 120; i++) {
      expect((await send('get', url).set('Authorization', token)).status).toBe(400);
    }
    for (const key of [process.env.API_KEY, 'invalid-key']) {
      const blocked = await send('get', url).set('Authorization', authorization('alice'))
        .set('x-api-key', key).set('X-Forwarded-For', '203.0.113.9');
      expect(blocked.status).toBe(429);
      expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    }
    expect((await send('get', url).set('Authorization', authorization('bob'))).status).toBe(400);
  }, 20000);

  test('the outer request budget limits API-key-only callers without granting directory access', async () => {
    for (let i = 0; i < 120; i++) {
      expect((await send('get', '/users').set('x-api-key', process.env.API_KEY)).status).toBe(401);
    }
    const blocked = await send('get', '/users').set('x-api-key', process.env.API_KEY);
    expect(blocked.status).toBe(429);
  }, 20000);
});
