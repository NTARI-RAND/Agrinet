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
    ({ app } = require('../server'));
  });

  beforeEach(() => mockUsers.clear());

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
    expect(users.body).toEqual([login.body.user]);
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
});
