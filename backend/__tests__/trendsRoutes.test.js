const request = require('supertest');
const express = require('express');

const mockScan = jest.fn();

jest.mock('../lib/dynamodbClient', () => ({
  scan: mockScan
}));

const trendsRoutes = require('../trends/trendsRoutes');
const { USER_TABLE_NAME } = require('../models/user');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');

const PUBLIC_FIELDS = ['id', 'username', 'locationType', 'reputationScore', 'reputationWeight'];

const producers = [
  {
    id: 'u1',
    username: 'alice',
    email: 'alice@example.test',
    phone: '+15550101',
    password: '$2a$10$alicehashalicehash',
    role: 'producer',
    verified: true,
    verificationCode: '111111',
    location: 'RegionX',
    coordinates: { lat: 1, long: 2 },
    locationType: 'farm',
    locationPrivacy: false,
    reputationScore: 3,
    reputationWeight: 2
  },
  {
    id: 'u2',
    username: 'bea',
    email: 'bea@example.test',
    phone: '+15550102',
    password: '$2a$10$beahashbeahashbea',
    role: 'producer',
    verified: false,
    location: 'RegionX',
    locationPrivacy: true,
    reputationScore: 5,
    reputationWeight: 1
  },
  {
    id: 'u3',
    email: 'nousername@example.test',
    phone: '+15550103',
    password: '$2a$10$thirdhashthirdhash',
    role: 'producer',
    location: 'RegionX',
    reputationScore: 4
  }
];

const tables = {
  [USER_TABLE_NAME]: producers,
  [LISTING_TABLE_NAME]: [{ id: 'l1', userId: 'u1', location: 'RegionX', createdAt: '2026-11-01T00:00:00Z' }],
  [TRANSACTION_TABLE_NAME]: [{ id: 't1', sellerId: 'u1', lastPing: '2026-11-01T00:00:00Z', pingCount: 1 }]
};

const getRoutes = trendsRoutes.stack
  .filter(layer => layer.route && layer.route.methods.get)
  .map(layer => layer.route.path);

describe('trendsRoutes', () => {
  let app;
  beforeEach(() => {
    mockScan.mockReset();
    mockScan.mockImplementation(params => ({
      promise: () => Promise.resolve({ Items: (tables[params.TableName] || []).map(item => ({ ...item })) })
    }));
    app = express();
    app.use('/trends', trendsRoutes);
  });

  it('covers every GET route', () => {
    expect(getRoutes).toEqual(expect.arrayContaining(['/top-rated', '/ai/insight']));
  });

  describe.each(getRoutes)('GET /trends%s', (path) => {
    it.each([
      ['without region', ''],
      ['with region', '?region=RegionX']
    ])('sends no password hash, email or phone %s', async (_label, query) => {
      const res = await request(app).get(`/trends${path}${query}`);

      expect(res.status).toBe(200);
      const body = JSON.stringify(res.body);
      for (const user of producers) {
        expect(body).not.toContain(user.password);
        expect(body).not.toContain(user.email);
        expect(body).not.toContain(user.phone);
      }
    });
  });

  describe('GET /trends/top-rated', () => {
    it('returns only public producer fields', async () => {
      const res = await request(app).get('/trends/top-rated');

      expect(res.status).toBe(200);
      expect(res.body.map(p => p.id)).toEqual(['u2', 'u3', 'u1']);
      for (const item of res.body) {
        for (const key of Object.keys(item)) {
          expect(PUBLIC_FIELDS).toContain(key);
        }
      }
      expect(res.body[2]).toEqual({
        id: 'u1',
        username: 'alice',
        locationType: 'farm',
        reputationScore: 3,
        reputationWeight: 2
      });
    });

    it('leaves location-private producers out of region results', async () => {
      const res = await request(app).get('/trends/top-rated?region=RegionX');

      expect(res.status).toBe(200);
      expect(res.body.map(p => p.id)).toEqual(['u3', 'u1']);
    });

    it('treats a non-boolean locationPrivacy as private', async () => {
      mockScan.mockImplementationOnce(() => ({
        promise: () => Promise.resolve({
          Items: [
            { id: 'u4', username: 'dee', role: 'producer', location: 'RegionX', locationPrivacy: 'true', reputationScore: 3 },
            { id: 'u5', username: 'eve', role: 'producer', location: 'RegionX', locationPrivacy: 1, reputationScore: 2 },
            { id: 'u6', username: 'fay', role: 'producer', location: 'RegionX', reputationScore: 1 }
          ]
        })
      }));

      const res = await request(app).get('/trends/top-rated?region=RegionX');

      expect(res.status).toBe(200);
      expect(res.body.map(p => p.id)).toEqual(['u6']);
    });
  });
});
