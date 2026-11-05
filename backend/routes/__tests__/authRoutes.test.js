const request = require('supertest');
const express = require('express');
const bcrypt = require('bcryptjs');

// Replaced in beforeEach with in-memory Users and UserEmails tables
jest.mock('../../lib/dynamodbClient', () => ({}));

const dynamoClient = require('../../lib/dynamodbClient');
const { memoryUserTables } = require('../../test-support/memoryUserTables');
const authRoutes = require('../authRoutes');

function cancelled(code) {
  return Object.assign(new Error('Transaction cancelled'), {
    code: 'TransactionCanceledException',
    CancellationReasons: [{ Code: code }, { Code: 'None' }]
  });
}

describe('authRoutes', () => {
  let app;
  let db;
  beforeEach(() => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    app = express();
    app.use(express.json());
    app.use('/', authRoutes);
    db = memoryUserTables();
    Object.assign(dynamoClient, db);
  });

  const register = (email, password = 'plainpass') =>
    request(app).post('/register').send({ username: 'john', email, phone: '123', password });

  describe('POST /register', () => {
    it('responds with 201, hashes password and claims the normalised email', async () => {
      const res = await register('  John@Example.COM ').expect(201);

      expect(res.body).toEqual({ message: 'User registered. Please verify your email/phone.' });
      const [user] = db.tables.Users.values();
      expect(user.email).toBe('john@example.com');
      expect(user.password).not.toBe('plainpass');
      expect(await bcrypt.compare('plainpass', user.password)).toBe(true);
      expect(db.tables.UserEmails.get('john@example.com')).toEqual({ email: 'john@example.com', userId: user.id });
    });

    it('refuses a second account for the same email in any case or spacing', async () => {
      await register('john@example.com').expect(201);
      const res = await register('  JOHN@example.com ').expect(409);

      expect(res.body).toEqual({ error: 'Account could not be created' });
      expect(db.tables.Users.size).toBe(1);
    });

    it('lets only one of two concurrent registrations claim an email', async () => {
      // Hold writes until both requests reach one, so any reads they make come
      // first and only a conditional write can refuse the second account.
      let arrived = 0;
      let release;
      const bothArrived = new Promise((resolve) => { release = resolve; });
      for (const method of ['put', 'transactWrite']) {
        const write = db[method];
        dynamoClient[method] = (params) => ({ promise: async () => {
          if (++arrived === 2) release();
          await bothArrived;
          return write(params).promise();
        } });
      }

      const results = await Promise.all([register('ann@example.com'), register('Ann@Example.com')]);

      expect(results.map((res) => res.status).sort()).toEqual([201, 409]);
      expect(db.tables.Users.size).toBe(1);
      expect(db.tables.UserEmails.size).toBe(1);
    });

    it('returns 409 and writes no user when the conditional claim fails', async () => {
      dynamoClient.transactWrite = () => ({ promise: () => Promise.reject(cancelled('ConditionalCheckFailed')) });

      await register('john@example.com').expect(409);
      expect(db.tables.Users.size).toBe(0);
    });

    it('reports other cancelled transactions as errors, not duplicates', async () => {
      dynamoClient.transactWrite = () => ({ promise: () => Promise.reject(cancelled('TransactionConflict')) });

      await register('john@example.com').expect(500);
    });

    it('requires an email', async () => {
      await register(undefined).expect(400);
      await register('   ').expect(400);
      expect(db.tables.Users.size).toBe(0);
    });
  });

  describe('POST /login', () => {
    it('valid email/password returns token and user without password', async () => {
      await register('john@example.com').expect(201);
      const [stored] = db.tables.Users.values();

      const res = await request(app)
        .post('/login')
        .send({ email: ' John@Example.com ', password: 'plainpass' })
        .expect(200);

      expect(res.body.token).toBeDefined();
      expect(res.body.user).toBeDefined();
      expect(res.body.user.id).toBe(stored.id);
      expect(res.body.user.password).toBeUndefined();
    });

    it('finds the claimed account when it is not on the first scan page', async () => {
      const password = await bcrypt.hash('plainpass', 10);
      db.tables.Users.set('u1', { id: 'u1', email: 'other@example.com', password });
      db.tables.Users.set('u2', { id: 'u2', email: 'john@example.com', password });
      db.tables.UserEmails.set('john@example.com', { email: 'john@example.com', userId: 'u2' });

      const res = await request(app)
        .post('/login')
        .send({ email: 'john@example.com', password: 'plainpass' })
        .expect(200);

      expect(res.body.user.id).toBe('u2');
    });

    it('does not pick one of several accounts sharing an unclaimed email', async () => {
      const password = await bcrypt.hash('plainpass', 10);
      db.tables.Users.set('u1', { id: 'u1', email: 'john@example.com', password });
      db.tables.Users.set('u2', { id: 'u2', email: 'john@example.com', password });

      await request(app)
        .post('/login')
        .send({ email: 'john@example.com', password: 'plainpass' })
        .expect(401);
    });

    it('invalid password returns 401', async () => {
      await register('john@example.com', 'rightpass').expect(201);

      await request(app)
        .post('/login')
        .send({ email: 'john@example.com', password: 'wrongpass' })
        .expect(401);
    });

    it('returns 401 when no user matches the email', async () => {
      await request(app)
        .post('/login')
        .send({ email: 'missing@example.com', password: 'plainpass' })
        .expect(401);
    });
  });
});
