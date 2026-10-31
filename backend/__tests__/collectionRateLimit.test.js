const request = require('supertest');
const http = require('node:http');
const jwt = require('jsonwebtoken');

jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());

describe('directory and attachment request budgets', () => {
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

  test.each([
    ['/users?limit=0', 400],
    ['/uploads/bad%00name', 404],
  ])('%s preserves normal responses and throttles each account independently', async (url, status) => {
    const token = authorization('alice');
    for (let i = 0; i < 1000; i++) {
      expect((await send('get', url).set('Authorization', token)).status).toBe(status);
    }
    const blocked = await send('get', url).set('Authorization', authorization('alice'))
      .set('X-Forwarded-For', '203.0.113.9');
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await send('get', url).set('Authorization', authorization('bob'))).status).toBe(status);
  }, 20000);

  test.each(['/users', '/uploads/bad%00name'])('%s limits API-key-only callers without granting account access', async url => {
    for (let i = 0; i < 1000; i++) {
      expect((await send('get', url).set('x-api-key', process.env.API_KEY)).status).toBe(401);
    }
    const blocked = await send('get', url).set('x-api-key', process.env.API_KEY)
      .set('X-Forwarded-For', '203.0.113.10');
    expect(blocked.status).toBe(429);
  }, 20000);

  test.each([
    ['/users?limit=0', 400],
    ['/uploads/bad%00name', 404],
  ])('%s cannot gain another account budget by adding an API key', async (url, status) => {
    const token = authorization('credential-owner');
    for (let i = 0; i < 1000; i++) {
      expect((await send('get', url).set('Authorization', token)).status).toBe(status);
    }
    for (const key of [process.env.API_KEY, 'invalid-key']) {
      expect((await send('get', url).set('Authorization', token).set('x-api-key', key)).status).toBe(429);
    }
  }, 20000);
});
