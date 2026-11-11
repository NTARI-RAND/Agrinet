const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

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
    process.env.JWT_SECRET = 'directory-test-key';
    app.use((req, _res, next) => { req.user = { userId: 'admin-1', role: 'admin' }; next(); });
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

      const res = await request(app).get('/users').set('Authorization', `Bearer ${jwt.sign({ userId: 'test' }, process.env.JWT_SECRET)}`);
      expect(res.status).toBe(200);
      expect(res.body).toEqual([
        { id: '1', username: 'john', role: 'consumer' }
      ]);
      expect(res.body[0].password).toBeUndefined();
    });

    it('applies role and location filters', async () => {
      docClient.scan.mockReturnValue({ promise: () => Promise.resolve({ Items: [] }) });

      await request(app).get('/users?role=farmer&location=Texas').set('Authorization', `Bearer ${jwt.sign({ userId: 'test' }, process.env.JWT_SECRET)}`);

      expect(docClient.scan).toHaveBeenCalledWith(
        expect.objectContaining({
          FilterExpression: '#role = :role AND #location = :location AND #privacy = :public',
          ExpressionAttributeValues: { ':role': 'farmer', ':location': 'Texas', ':public': true }
        })
      );
    });
  });

  test('rejects caller-supplied IDs before writing', async () => {
    const response = await request(app).post('/users').send({
      id: 'victim-id', username: 'attacker', email: 'a@example.test', password: 'long-password'
    });
    expect(response.status).toBe(400);
    expect(docClient.put).not.toHaveBeenCalled();
  });

  test('rejects shared API-key-style callers without a verified admin identity', async () => {
    app = express();
    app.use(express.json());
    app.use('/users', userRoutes);
    const response = await request(app).post('/users').send({
      username: 'attacker', email: 'a@example.test', password: 'long-password'
    });
    expect(response.status).toBe(403);
    expect(docClient.put).not.toHaveBeenCalled();
  });

  test('rejects authenticated non-admin callers', async () => {
    app = express();
    app.use(express.json());
    app.use((req, _res, next) => {
      req.user = { userId: 'member-1', role: 'consumer' };
      next();
    });
    app.use('/users', userRoutes);
    const response = await request(app).post('/users').send({
      username: 'member', email: 'm@example.test', password: 'long-password'
    });
    expect(response.status).toBe(403);
    expect(docClient.put).not.toHaveBeenCalled();
  });

  test('creates a server-ID account with a hash and atomic no-overwrite condition', async () => {
    docClient.put.mockReturnValue({ promise: async () => ({}) });
    const response = await request(app).post('/users').send({
      username: 'alice', email: 'a@b.com', password: 'secretsecret',
      role: 'producer', locationType: 'farm'
    });

    expect(response.status).toBe(201);
    expect(response.body.user).toMatchObject({ username: 'alice', locationType: 'farm' });
    expect(response.body.user.id).toBeTruthy();
    expect(response.body.user.role).toBeUndefined();
    const params = docClient.put.mock.calls[0][0];
    expect(params.ConditionExpression).toBe('attribute_not_exists(#id)');
    expect(params.Item.id).not.toBe('undefined');
    expect(await bcrypt.compare('secretsecret', params.Item.password)).toBe(true);
  });

  test('reports conditional ID collision without overwriting', async () => {
    docClient.put.mockReturnValue({
      promise: async () => { throw Object.assign(new Error('collision'), { code: 'ConditionalCheckFailedException' }); }
    });
    const response = await request(app).post('/users').send({
      username: 'alice', email: 'a@b.com', password: 'secretsecret'
    });
    expect(response.status).toBe(409);
  });
});
