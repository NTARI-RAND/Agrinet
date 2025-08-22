const express = require('express');
const request = require('supertest');

const scanMock = jest.fn();
const populateMock = jest.fn();
const findMock = jest.fn(() => ({ populate: populateMock }));

jest.mock('../../lib/dynamodbClient', () => ({ scan: scanMock }));
jest.mock('../../models/key', () => ({ find: findMock }));

const { USER_TABLE_NAME } = require('../../models/user');
const adminRouter = require('../admin');

const app = express();
app.use('/', adminRouter);

beforeEach(() => {
  scanMock.mockReset();
  populateMock.mockReset();
  findMock.mockClear();
});

describe('GET /users', () => {
  it('uses scan and omits password', async () => {
    scanMock.mockReturnValue({
      promise: jest.fn().mockResolvedValue({
        Items: [
          { id: '1', username: 'alice', password: 'secret' }
        ]
      })
    });

    const res = await request(app).get('/users');

    expect(scanMock).toHaveBeenCalledWith({ TableName: USER_TABLE_NAME });
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ id: '1', username: 'alice' }]);
    expect(res.body[0].password).toBeUndefined();
  });

  it('returns 500 when scan rejects', async () => {
    scanMock.mockReturnValue({
      promise: jest.fn().mockRejectedValue(new Error('fail'))
    });

    const res = await request(app).get('/users');

    expect(scanMock).toHaveBeenCalled();
    expect(res.status).toBe(500);
  });
});

describe('GET /keys', () => {
  it('returns populated keys', async () => {
    const sampleKeys = [
      {
        id: 'k1',
        key: 'abc',
        userId: { username: 'bob', email: 'bob@example.com' }
      }
    ];
    populateMock.mockResolvedValue(sampleKeys);

    const res = await request(app).get('/keys');

    expect(findMock).toHaveBeenCalled();
    expect(populateMock).toHaveBeenCalledWith('userId', 'username email');
    expect(res.status).toBe(200);
    expect(res.body).toEqual(sampleKeys);
  });
});
