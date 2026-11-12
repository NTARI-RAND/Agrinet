const request = require('supertest');
const jwt = require('jsonwebtoken');
jest.mock('../lib/dynamodbClient', () => ({
  scan: () => ({ promise: async () => ({ Items: [] }) }),
  get: () => ({ promise: async () => ({}) }),
}));
jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());

describe('account-keyed rate limits on private routes', () => {
  let app;
  const originalEnv = { ...process.env };
  const globals = Object.fromEntries(['broadcast', 'emitToken', 'emitMessage'].map(key => [key, global[key]]));
  const bearer = userId => `Bearer ${jwt.sign({ userId }, process.env.JWT_SECRET, { expiresIn: '1h' })}`;
  beforeAll(() => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.JWT_SECRET = 'rate-test-secret';
    ({ app } = require('../server'));
  });
  afterAll(() => {
    process.env = originalEnv;
    for (const [key, value] of Object.entries(globals)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  });
  test.each(['/conversations', '/messages/missing', '/uploads/missing.txt'])('%s rejects excess requests per verified account', async path => {
    expect((await request(app).get(path)).status).toBe(403);
    const account = 'limit-' + path;
    const first = await request(app).get(path).set('Authorization', bearer(account));
    expect(first.status).not.toBe(429);
    expect(first.headers['ratelimit-limit']).toBeDefined();
    const limit = Number(first.headers['ratelimit-limit']);
    expect(limit).toBeGreaterThan(0);
    for (let i = 1; i < limit; i++) {
      const result = await request(app).get(path).set('Authorization', bearer(account));
      expect(result.status).not.toBe(429);
    }
    const blocked = await request(app).get(path).set('Authorization', bearer(account));
    expect(blocked.status).toBe(429);
    expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);
    expect((await request(app).get(path).set('Authorization', bearer('another-' + path))).status).not.toBe(429);
  });
});
