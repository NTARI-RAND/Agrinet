const request = require('supertest');
const express = require('express');
const jwt = require('../../utils/jwt');

// Auth middleware, routes, controller and KeyLibrary are real; only storage is replaced.
const mockKeys = [];
jest.mock('../../lib/dynamodbClient', () => ({
  scan: ({ ExpressionAttributeValues: values }) => ({
    promise: async () => ({
      Items: mockKeys.filter(k => k.userId === values[':u'] && k.retired === values[':r']),
    }),
  }),
  put: ({ Item }) => ({ promise: async () => { mockKeys.push(Item); return {}; } }),
}));

const authMiddleware = require('../../middleware/authMiddleware');
const keyRoutes = require('../../routes/keyRoutes');

const app = express();
app.use(express.json());
app.use(authMiddleware);
app.use('/api/keys', keyRoutes);

describe('POST /api/keys/issue-key', () => {
  const originalEnv = { API_KEY: process.env.API_KEY, JWT_SECRET: process.env.JWT_SECRET };
  const bearer = userId => `Bearer ${jwt.sign({ userId, role: 'consumer' }, process.env.JWT_SECRET)}`;

  beforeAll(() => {
    process.env.API_KEY = 'issue-key-test-api-key';
    process.env.JWT_SECRET = 'issue-key-test-secret';
  });

  afterAll(() => {
    for (const [key, value] of Object.entries(originalEnv)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  });

  beforeEach(() => { mockKeys.length = 0; });

  test('refuses the shared API key when no account is signed in', async () => {
    const res = await request(app).post('/api/keys/issue-key')
      .set('x-api-key', process.env.API_KEY)
      .send({ userId: 'grower-1' });
    expect(res.status).toBe(401);
    expect(mockKeys).toEqual([]);
  });

  test('issues a key for the account in the bearer token', async () => {
    const res = await request(app).post('/api/keys/issue-key')
      .set('Authorization', bearer('grower-1'))
      .send({});
    expect(res.status).toBe(201);
    expect(res.body.data.userId).toBe('grower-1');
    expect(mockKeys).toEqual([expect.objectContaining({ userId: 'grower-1', retired: false })]);
  });

  test('does not issue a key for another account named in the body', async () => {
    const res = await request(app).post('/api/keys/issue-key')
      .set('Authorization', bearer('grower-1'))
      .send({ userId: 'grower-2' });
    expect(res.status).toBe(403);
    expect(mockKeys).toEqual([]);
  });
});
