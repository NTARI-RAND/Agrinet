const express = require('express');
const request = require('supertest');

const mockScan = jest.fn();

jest.mock('../../lib/dynamodbClient', () => ({ scan: mockScan }));

const { USER_TABLE_NAME } = require('../../models/user');
const adminRouter = require('../admin');

const app = express();
app.use('/', adminRouter);

beforeEach(() => {
  mockScan.mockReset();
});

describe('GET /users', () => {
  it('uses scan and omits password', async () => {
    mockScan.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          { id: '1', username: 'alice', password: 'secret' }
        ]
      })
    });

    const res = await request(app).get('/users');

    expect(mockScan).toHaveBeenCalledWith({ TableName: USER_TABLE_NAME });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', username: 'alice' }]);
    expect(res.body[0].password).toBeUndefined();
  });

  it('returns 500 when scan rejects', async () => {
    mockScan.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('fail'))
    });

    const res = await request(app).get('/users');

    expect(mockScan).toHaveBeenCalled();
    expect(res.status).toBe(500);
  });
});

describe('GET /keys', () => {
  it('returns stored keys', async () => {
    const sampleKeys = [
      {
        id: 'k1',
        key: 'abc',
        userId: 'u1'
      }
    ];
    mockScan.mockReturnValue({ promise: async () => ({ Items: sampleKeys }) });

    const res = await request(app).get('/keys');

    expect(mockScan).toHaveBeenCalledWith({ TableName: 'Keys' });
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sampleKeys);
  });
});
