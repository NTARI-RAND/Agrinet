const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn()
}));
jest.mock('../../lib/httpClient');

const dynamodbClient = require('../../lib/dynamodbClient');
const http = require('../../lib/httpClient');
const federationStatusRouter = require('../federationStatus');

const app = express();
app.use(federationStatusRouter);

describe('GET /federation/status', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns federation health with last sync times', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.resolve({
        Items: [
          { nodeUrl: 'http://node1.com', lastSyncAt: '2024-01-01T00:00:00Z' },
          { nodeUrl: 'http://node2.com', lastSyncAt: '2024-01-02T00:00:00Z' }
        ]
      })
    });

    http.get.mockImplementation((url) => {
      if (url.includes('node1')) {
        return Promise.resolve({
          data: {
            listings: [1, 2],
            transactions: [1],
            users: [1]
          }
        });
      }
      return Promise.reject(new Error('Network Error'));
    });

    const res = await request(app).get('/federation/status');

    expect(res.status).toBe(200);
    expect(res.body).toEqual({
      federationHealth: [
        {
          node: 'http://node1.com',
          status: 'ONLINE',
          listings: 2,
          transactions: 1,
          users: 1,
          lastSync: '2024-01-01T00:00:00Z'
        },
        {
          node: 'http://node2.com',
          status: 'OFFLINE',
          error: 'Network Error',
          listings: 0,
          transactions: 0,
          users: 0,
          lastSync: '2024-01-02T00:00:00Z'
        }
      ]
    });
  });

  it('returns 500 when scan fails', async () => {
    dynamodbClient.scan.mockReturnValue({
      promise: () => Promise.reject(new Error('Scan failed'))
    });

    const res = await request(app).get('/federation/status');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to validate federation status' });
  });
});
