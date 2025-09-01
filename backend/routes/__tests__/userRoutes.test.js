const request = require('supertest');
const express = require('express');
const crypto = require('crypto');
const bcrypt = {
  hash: async (pw) => crypto.createHash('sha256').update(pw).digest('hex'),
  compare: async (pw, hashed) => crypto.createHash('sha256').update(pw).digest('hex') === hashed
};

jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  put: jest.fn()
}));

const docClient = require('../../lib/dynamodbClient');
const userRoutes = require('../userRoutes');

describe('userRoutes', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/users', userRoutes);
    docClient.scan.mockReset();
    docClient.put.mockReset();
  });

  describe('GET /users', () => {
    it('returns users without passwords', async () => {
      docClient.scan.mockReturnValue({
        promise: () => Promise.resolve({
          Items: [
            { id: '1', username: 'john', password: 'hash', role: 'consumer', location: 'NY' }
          ]
        })
      });

      const res = await request(app).get('/users');
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: '1', username: 'john', role: 'consumer', location: 'NY' }
      ]);
      expect(res.body[0].password).toBeUndefined();
    });

    it('applies role and location filters', async () => {
      docClient.scan.mockReturnValue({ promise: () => Promise.resolve({ Items: [] }) });

      await request(app).get('/users?role=farmer&location=Texas');

      expect(docClient.scan).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: 'role = :role AND location = :location',
          ExpressionAttributeValues: { ':role': 'farmer', ':location': 'Texas' }
        })
      );
    });
  });

  describe('POST /users', () => {
    it('creates user with hashed password and defaults', async () => {
      docClient.put.mockReturnValue({ promise: () => Promise.resolve({}) });

      const res = await request(app)
        .post('/users')
        .send({
          id: '1',
          username: 'alice',
          email: 'a@b.com',
          password: 'secret',
          role: 'producer',
          location: 'CA'
        });

      expect(res.status).toBe(201);
      expect(res.body.user).toMatchObject({
        id: '1',
        username: 'alice',
        email: 'a@b.com',
        role: 'producer',
        location: 'CA',
        verified: false,
        reputationScore: 0
      });
      expect(res.body.user.password).toBeUndefined();

      const params = docClient.put.mock.calls[0][0];
      const stored = params.Item;
      expect(stored.verified).toBe(false);
      expect(stored.reputationScore).toBe(0);
      expect(await bcrypt.compare('secret', stored.password)).toBe(true);
    });
  });
});

