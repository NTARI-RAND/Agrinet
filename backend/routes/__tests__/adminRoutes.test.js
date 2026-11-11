const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn()
}));

const docClient = require('../../lib/dynamodbClient');
const adminRoutes = require('../admin');

describe('admin routes access and response contracts', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { userId: 'admin-1', role: 'admin' };
      next();
    });
    app.use('/api/admin', adminRoutes);
    docClient.scan.mockReset();
  });

  test('denies shared-key callers without a verified admin identity', async () => {
    app = express();
    app.use('/api/admin', adminRoutes);
    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(403);
  });

  test('returns only administrator-approved user fields', async () => {
    docClient.scan.mockReturnValue({
      promise: async () => ({
        Items: [{
          id: 'u1', username: 'alice', email: 'alice@example.test', phone: '555-0100',
          role: 'consumer', verified: true, password: 'bcrypt-hash',
          verificationCode: 'secret', coordinates: { lat: 1, long: 2 },
          locationType: 'farm', reputationScore: 3
        }]
      })
    });
    const response = await request(app).get('/api/admin/users');
    expect(response.status).toBe(200);
    expect(response.body).toEqual([{
      id: 'u1', username: 'alice', email: 'alice@example.test', phone: '555-0100',
      role: 'consumer', verified: true, locationType: 'farm', reputationScore: 3
    }]);
    expect(docClient.scan).toHaveBeenCalledWith(expect.objectContaining({
      ProjectionExpression: expect.stringContaining('email')
    }));
  });
});
