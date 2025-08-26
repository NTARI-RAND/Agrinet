const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({
  put: jest.fn().mockReturnValue({ promise: () => Promise.resolve({}) }),
  scan: jest.fn().mockReturnValue({ promise: () => Promise.resolve({ Items: [] }) })
}));

const marketplaceRoutes = require('../../marketplace/marketplace_routes');
const docClient = require('../../lib/dynamodbClient');

const app = express();
app.use(express.json());
app.use('/', marketplaceRoutes);

describe('marketplace listing routes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /listings creates service listing with limited media', async () => {
    const res = await request(app).post('/listings').send({
      t: 'Soil Planning',
      c: 'la-pa',
      d: 'Plan your soil',
      term: 50,
      med: ['1','2','3','4','5','6']
    });
    expect(res.status).toBe(201);
    expect(res.body.listing.media.length).toBe(5);
    expect(res.body.listing.tags).toContain('la-pa');
    expect(docClient.put).toHaveBeenCalled();
  });
});
