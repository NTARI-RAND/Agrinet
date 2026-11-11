const express = require('express');
const request = require('supertest');

const mockScan = jest.fn();

jest.mock('../../lib/dynamodbClient', () => ({ scan: mockScan }));

const { USER_TABLE_NAME } = require('../../models/user');
const adminRouter = require('../admin');

const app = express();
app.use((req, _res, next) => { req.user = { userId: 'test-admin', role: 'admin' }; next(); });
app.use('/', adminRouter);

beforeEach(() => mockScan.mockReset());

describe('GET /users', () => {
  it('uses a minimal projection and omits private account fields', async () => {
    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [{ id: '1', username: 'alice', email: 'a@example.test', role: 'consumer', password: 'secret', verificationCode: 'secret' }]
      })
    });
    const res = await request(app).get('/users');
    expect(mockScan).toHaveBeenCalledWith(expect.objectContaining({
      TableName: USER_TABLE_NAME,
      ProjectionExpression: expect.stringContaining('email')
    }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', username: 'alice', email: 'a@example.test', role: 'consumer' }]);
    expect(res.body[0].password).toBeUndefined();
    expect(res.body[0].verificationCode).toBeUndefined();
  });

  it('returns 500 when scan rejects', async () => {
    mockScan.mockReturnValue({ promise: jest.fn().mockRejectedValue(new Error('fail')) });
    const res = await request(app).get('/users');
    expect(mockScan).toHaveBeenCalled();
    expect(res.status).toBe(500);
  });
});

describe('GET /keys', () => {
  it('returns only non-secret key metadata', async () => {
    const sampleKeys = [{ id: 'k1', userId: 'u1', issuedAt: '2026-01-01', usageCount: 1, expiresAt: '2027-01-01', key: 'secret-value' }];
    mockScan.mockReturnValue({ promise: async () => ({ Items: sampleKeys }) });
    const res = await request(app).get('/keys');
    expect(mockScan).toHaveBeenCalledWith(expect.objectContaining({ TableName: 'Keys', ProjectionExpression: expect.any(String) }));
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: 'k1', userId: 'u1', issuedAt: '2026-01-01', usageCount: 1, expiresAt: '2027-01-01' }]);
  });
});
