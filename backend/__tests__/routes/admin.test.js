const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({ scan: jest.fn() }));
const docClient = require('../../lib/dynamodbClient');
const adminRouter = require('../../routes/admin');
const app = express();
app.use((req, _res, next) => { req.user = { userId: 'test-admin', role: 'admin' }; next(); });
app.use('/', adminRouter);

describe.each([
  { route: 'users', table: 'Users', item: { id: 'u1', username: 'Alice', email: 'alice@example.test', role: 'consumer' }, expected: { id: 'u1', username: 'Alice', email: 'alice@example.test', role: 'consumer' } },
  { route: 'keys', table: 'Keys', item: { id: 'k1', userId: 'u1', key: 'secret', usageCount: 2 }, expected: { id: 'k1', userId: 'u1', usageCount: 2 } },
])('admin GET /$route', ({ route, table, item, expected }) => {
  beforeEach(() => docClient.scan.mockReset());

  test('returns sanitized records from the expected table', async () => {
    docClient.scan.mockReturnValue({ promise: async () => ({ Items: [item] }) });
    const response = await request(app).get('/' + route);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([expected]);
    expect(docClient.scan).toHaveBeenCalledWith(expect.objectContaining({ TableName: table, ProjectionExpression: expect.any(String) }));
  });

  test('returns 500 on a storage error', async () => {
    docClient.scan.mockReturnValue({ promise: async () => { throw new Error('fail'); } });
    const response = await request(app).get('/' + route);
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});
