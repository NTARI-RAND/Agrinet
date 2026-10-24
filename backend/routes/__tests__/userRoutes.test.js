const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const { randomUUID } = require('crypto');

jest.mock('crypto', () => ({
  ...jest.requireActual('crypto'),
  randomUUID: jest.fn(() => jest.requireActual('crypto').randomUUID())
}));

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
        username: 'alice',
        email: 'a@b.com',
        role: 'producer',
        location: 'CA',
        verified: false,
        reputationScore: 0
      });
      expect(res.body.user.password).toBeUndefined();
      expect(res.body.user.id).toMatch(/^[0-9a-f-]{36}$/);
      expect(res.body.user.id).not.toBe('1');

      const params = docClient.put.mock.calls[0][0];
      const stored = params.Item;
      expect(stored.verified).toBe(false);
      expect(stored.reputationScore).toBe(0);
      expect(await bcrypt.compare('secret', stored.password)).toBe(true);
    });

    it('cannot replace an existing user through a caller-selected id', async () => {
      const victim = { id: 'victim', username: 'victim', password: 'original hash' };
      const users = new Map([[victim.id, victim]]);
      docClient.put.mockImplementation(({ Item, ConditionExpression }) => ({
        promise: async () => {
          if (ConditionExpression === 'attribute_not_exists(id)' && users.has(Item.id)) {
            throw Object.assign(new Error('User already exists'), { code: 'ConditionalCheckFailedException' });
          }
          users.set(Item.id, Item);
          return {};
        }
      }));

      const res = await request(app).post('/users').send({
        id: 'victim', username: 'attacker', password: 'replacement'
      });

      expect(res.status).toBe(201);
      expect(users.get('victim')).toEqual(victim);
      expect(res.body.user.id).not.toBe('victim');
      expect(users.get(res.body.user.id).username).toBe('attacker');
    });

    it('returns conflict without overwriting an existing generated id', async () => {
      const victim = { id: 'collision', username: 'victim', password: 'original hash' };
      const users = new Map([[victim.id, victim]]);
      randomUUID.mockReturnValueOnce('collision');
      docClient.put.mockImplementation(({ Item, ConditionExpression }) => ({
        promise: async () => {
          if (ConditionExpression === 'attribute_not_exists(id)' && users.has(Item.id)) {
            throw Object.assign(new Error('User already exists'), { code: 'ConditionalCheckFailedException' });
          }
          users.set(Item.id, Item);
          return {};
        }
      }));

      const res = await request(app).post('/users').send({
        id: 'collision', username: 'attacker', password: 'replacement'
      });

      expect(res.status).toBe(409);
      expect(users.get('collision')).toEqual(victim);
    });
  });
});

