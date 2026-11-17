const request = require('supertest');
const bcrypt = require('../utils/bcrypt');
const jwt = require('../utils/jwt');

// Keep the production app, routes, password hashing, and token checks real.
// Only persistence and background work that needs external services are replaced.
const mockUsers = new Map();
jest.mock('../lib/dynamodbClient', () => ({
  put: ({ TableName, Item }) => ({ promise: async () => {
    if (TableName !== 'Users') throw new Error('Unexpected table');
    mockUsers.set(Item.id, { ...Item });
    return {};
  } }),
  scan: ({ TableName, FilterExpression, ExpressionAttributeValues }) => ({ promise: async () => {
    if (TableName === 'Keys') return { Items: [{ id: 'key-1', userId: 'victim', key: 'private-key' }] };
    if (TableName !== 'Users') throw new Error('Unexpected table');
    let Items = [...mockUsers.values()];
    if (FilterExpression) {
      if (FilterExpression !== 'email = :email') throw new Error('Unexpected filter');
      Items = Items.filter(user => user.email === ExpressionAttributeValues[':email']);
    }
    return { Items };
  } }),
}));
jest.mock('../bull/pingJobs', () => ({ addPingJob: jest.fn() }));
jest.mock('../bull/smsQueue', () => ({ enqueueSms: jest.fn() }));
jest.mock('../federation/federationSyncJob', () => jest.fn());

describe('production server authentication boundary', () => {
  const originalEnv = { ...process.env };
  const originalGlobals = Object.fromEntries(
    ['broadcast', 'emitToken', 'emitMessage'].map(key => [key, global[key]])
  );
  let app;

  beforeAll(() => {
    process.env.MINIMAL_SERVER = 'false';
    process.env.API_KEY = 'server-auth-test-key';
    process.env.JWT_SECRET = 'server-auth-test-secret';
    delete process.env.REDIS_URL;
    delete process.env.RATE_LIMIT_REDIS_REQUIRED;
  });

  beforeEach(() => {
    mockUsers.clear();
    // Fresh production limiters keep test ordering from consuming the auth quota.
    jest.resetModules();
    ({ app } = require('../server'));
  });

  afterAll(() => {
    process.env = originalEnv;
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete global[key];
      else global[key] = value;
    }
  });

  test('new user registers and logs in without an API key or bearer token', async () => {
    const registration = await request(app).post('/api/auth/register').send({
      username: 'farmer', email: 'farmer@example.com', phone: '123', password: 'field-password',
    });
    expect(registration.status).toBe(201);

    const login = await request(app).post('/api/auth/login').send({
      email: 'farmer@example.com', password: 'field-password',
    });
    expect(login.status).toBe(200);
    expect(login.body.user).toEqual(expect.objectContaining({
      id: expect.any(String), username: 'farmer', email: 'farmer@example.com', role: 'consumer',
    }));
    expect(login.body.user).not.toHaveProperty('password');
    expect(jwt.verify(login.body.token, process.env.JWT_SECRET)).toEqual(expect.objectContaining({
      userId: login.body.user.id, role: 'consumer',
    }));

    // The issued token must work through the same server's protected routes.
    const users = await request(app).get('/users').set('Authorization', `Bearer ${login.body.token}`);
    expect(users.status).toBe(200);
    expect(users.body).toEqual([{
      id: login.body.user.id, username: 'farmer', reputationScore: 0, reputationWeight: 0,
    }]);
  });

  test.each(['wrong password', 'unknown email'])('public login rejects %s as invalid credentials', async scenario => {
    mockUsers.set('existing-user', {
      id: 'existing-user', username: 'farmer', email: 'farmer@example.com',
      password: await bcrypt.hash('field-password', 10), role: 'consumer',
    });
    const response = await request(app).post('/api/auth/login').send({
      email: scenario === 'unknown email' ? 'missing@example.com' : 'farmer@example.com',
      password: scenario === 'wrong password' ? 'incorrect' : 'field-password',
    });
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Invalid credentials' });
  });

  test.each(['/users', '/api/auth/not-a-route'])('rejects unauthenticated access to %s', async route => {
    const response = await request(app).get(route);
    expect(response.status).toBe(403);
    expect(response.body).toEqual({ error: 'Unauthorized: Invalid API Key or Token' });
  });

  test('protected users route rejects an invalid bearer token', async () => {
    const response = await request(app).get('/users').set('Authorization', 'Bearer invalid-token');
    expect(response.status).toBe(401);
    expect(response.body).toEqual({ error: 'Unauthorized: Invalid Token' });
  });

  test.each([
    ['get', '/api/admin/users', 403],
    ['get', '/api/admin/keys', 403],
    ['post', '/users', 403],
    ['get', '/federation/export', 401],
    ['post', '/federation/import', 401],
  ])('consumer cannot %s %s', async (method, route, status) => {
    const password = await bcrypt.hash('field-password', 10);
    mockUsers.set('consumer', { id: 'consumer', email: 'consumer@example.com', password, role: 'consumer' });
    mockUsers.set('victim', {
      id: 'victim', email: 'private@example.com', phone: 'private-phone', password, role: 'consumer',
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'consumer@example.com', password: 'field-password',
    });
    expect(login.status).toBe(200);

    const response = await request(app)[method](route)
      .set('Authorization', `Bearer ${login.body.token}`)
      .send({
        id: 'victim', email: 'consumer@example.com', role: 'admin', password: 'replacement',
        users: [{ id: 'consumer', email: 'consumer@example.com', role: 'admin', password }],
      });
    expect(response.status).toBe(status);

    const secondLogin = await request(app).post('/api/auth/login').send({
      email: 'consumer@example.com', password: 'field-password',
    });
    expect(secondLogin.status).toBe(200);
    expect(secondLogin.body.user.role).toBe('consumer');
    const victimLogin = await request(app).post('/api/auth/login').send({
      email: 'private@example.com', password: 'field-password',
    });
    expect(victimLogin.status).toBe(200);
  });

  test('consumer directory access excludes other accounts private fields', async () => {
    const password = await bcrypt.hash('field-password', 10);
    mockUsers.set('consumer', { id: 'consumer', email: 'consumer@example.com', password, role: 'consumer' });
    mockUsers.set('victim', {
      id: 'victim', username: 'neighbor', email: 'private@example.com', phone: 'private-phone',
      password, role: 'admin', verified: true, verificationCode: 'secret-code',
      location: 'private address', coordinates: { lat: 1, long: 2 },
      locationType: 'farm', locationPrivacy: true, reputationScore: 3, reputationWeight: 2,
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'consumer@example.com', password: 'field-password',
    });
    expect(login.status).toBe(200);
    const response = await request(app).get('/users')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([
      { id: 'consumer' },
      { id: 'victim', username: 'neighbor', locationType: 'farm', reputationScore: 3, reputationWeight: 2 },
    ]);
  });

  test.each([
    ['get', '/api/admin/users', 403],
    ['get', '/api/admin/keys', 403],
    ['post', '/users', 403],
    ['get', '/federation/export', 401],
    ['post', '/federation/import', 401],
  ])('shared API key cannot %s %s', async (method, route, status) => {
    const response = await request(app)[method](route)
      .set('X-API-Key', process.env.API_KEY).send({});
    expect(response.status).toBe(status);
  });

  test('administrator login grants admin access without exposing account or key secrets', async () => {
    mockUsers.set('admin', {
      id: 'admin', username: 'operator', email: 'admin@example.com', phone: '123',
      password: await bcrypt.hash('field-password', 10), role: 'admin', verified: true,
      verificationCode: 'secret-code', coordinates: { lat: 1, long: 2 },
    });
    const login = await request(app).post('/api/auth/login').send({
      email: 'admin@example.com', password: 'field-password',
    });
    expect(login.status).toBe(200);
    expect(login.body.user).toEqual({
      id: 'admin', username: 'operator', email: 'admin@example.com', phone: '123',
      role: 'admin', verified: true,
    });
    const users = await request(app).get('/api/admin/users')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(users.status).toBe(200);
    expect(users.body).toEqual([login.body.user]);
    const keys = await request(app).get('/api/admin/keys')
      .set('Authorization', `Bearer ${login.body.token}`);
    expect(keys.status).toBe(200);
    expect(keys.body).toEqual([{ id: 'key-1', userId: 'victim' }]);
  });
});
