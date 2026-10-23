const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({ scan: jest.fn() }));
const docClient = require('../../lib/dynamodbClient');
const adminRouter = require('../../routes/admin');
const app = express();
app.use('/', adminRouter);

describe.each([
  { route: 'users', table: 'Users', item: { id: 'u1', username: 'Alice' } },
  { route: 'keys', table: 'Keys', item: { id: 'k1', key: 'abc' } },
])('admin GET /$route', ({ route, table, item }) => {
  beforeEach(() => docClient.scan.mockReset());

  test('returns stored records from the expected table', async () => {
    docClient.scan.mockReturnValue({ promise: async () => ({ Items: [item] }) });
    const response = await request(app).get('/' + route);
    expect(response.status).toBe(200);
    expect(response.body).toEqual([item]);
    expect(docClient.scan).toHaveBeenCalledWith({ TableName: table });
  });

  test('returns 500 on a storage error', async () => {
    docClient.scan.mockReturnValue({ promise: async () => { throw new Error('fail'); } });
    const response = await request(app).get('/' + route);
    expect(response.status).toBe(500);
    expect(response.body).toHaveProperty('error');
  });
});
