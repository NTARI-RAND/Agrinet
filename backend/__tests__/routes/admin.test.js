const request = require('supertest');
const express = require('express');

jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn()
}));

const docClient = require('../../lib/dynamodbClient');
const adminRouter = require('../../routes/admin');

describe('admin routes', () => {
  let app;

  beforeEach(() => {
    app = express();
    app.use('/', adminRouter);
    // generic error handler to send JSON
    app.use((err, req, res, next) => {
      res.status(500).json({ error: err.message });
    });
    docClient.scan.mockReset();
  });

  describe('GET /users', () => {
    it('returns scanned users', async () => {
      const items = [{ id: 1, name: 'Alice' }];
      docClient.scan.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: items })
      docClient.scan.mockReturnValueOnce(Promise.resolve({ Items: items }));

      const res = await request(app).get('/users');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(items);
    });

    it('handles scan errors', async () => {
      docClient.scan.mockReturnValueOnce({
        promise: () => Promise.reject(new Error('fail'))
      });

      const res = await request(app).get('/users');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });

  describe('GET /keys', () => {
    it('returns scanned keys', async () => {
      const items = [{ id: 1, key: 'abc' }];
      docClient.scan.mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: items })
      docClient.scan.mockReturnValueOnce(Promise.resolve({ Items: items }));

      const res = await request(app).get('/keys');

      expect(res.status).toBe(200);
      expect(res.body).toEqual(items);
    });

    it('handles scan errors', async () => {
      docClient.scan.mockReturnValueOnce({
        promise: () => Promise.reject(new Error('fail'))
      docClient.scan.mockReturnValueOnce(Promise.reject(new Error('fail')));

      const res = await request(app).get('/keys');

      expect(res.status).toBe(500);
      expect(res.body).toHaveProperty('error');
    });
  });
});

