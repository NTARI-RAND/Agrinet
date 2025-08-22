const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');

// Mock DynamoDB client methods
jest.mock('../../lib/dynamodbClient', () => {
  return {
    put: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({})
    }),
    query: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    }),
    scan: jest.fn().mockReturnValue({
      promise: jest.fn().mockResolvedValue({ Items: [] })
    })
  };
});

const dynamoClient = require('../../lib/dynamodbClient');
const authRoutes = require('../authRoutes');

describe('authRoutes', () => {
  let app;
  beforeEach(() => {
    app = express();
    app.use(express.json());
    app.use('/', authRoutes);
    jest.clearAllMocks();
  });

  describe('POST /register', () => {
    it('responds with 201 and hashes password', async () => {
      const res = await request(app)
        .post('/register')
        .send({ username: 'john', email: 'john@example.com', phone: '123', password: 'plainpass' })
        .expect(201);

      expect(res.body).toEqual({ message: 'User registered. Please verify your email/phone.' });
      expect(dynamoClient.put).toHaveBeenCalled();

      const params = dynamoClient.put.mock.calls[0][0];
      const item = params.Item || params;
      expect(item.password).not.toBe('plainpass');
    });
  });

  describe('POST /login', () => {
    it('valid email/password returns token and user without password', async () => {
      const hashed = await bcrypt.hash('plainpass', 10);
      dynamoClient.query.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: [{ email: 'john@example.com', password: hashed, username: 'john' }] })
      });

      const res = await request(app)
        .post('/login')
        .send({ email: 'john@example.com', password: 'plainpass' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.password).toBeUndefined();
    });

    it('invalid password/email returns 401', async () => {
      const hashed = await bcrypt.hash('rightpass', 10);
      dynamoClient.query.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: [{ email: 'john@example.com', password: hashed }] })
      });

      await request(app)
        .post('/login')
        .send({ email: 'john@example.com', password: 'wrongpass' })
        .expect(401);
    });

    it('executes scan when query returns no items', async () => {
      dynamoClient.query.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: [] })
      });

      dynamoClient.scan.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: [] })
      });

      await request(app)
        .post('/login')
        .send({ email: 'missing@example.com', password: 'plainpass' })
        .expect(401);

      expect(dynamoClient.scan).toHaveBeenCalled();
    });
  });
});

