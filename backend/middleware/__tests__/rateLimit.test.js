const express = require('express');
const request = require('supertest');
const { createRequestLimiter } = require('../rateLimit');

describe('request rate limiting', () => {
  test('limits by authenticated account identity', async () => {
    const app = express();
    app.use((req, _res, next) => { req.user = { userId: 'account-a' }; next(); });
    app.get('/limited', createRequestLimiter({ prefix: 'test-account', limit: 1 }), (_req, res) => res.sendStatus(204));
    expect((await request(app).get('/limited')).status).toBe(204);
    expect((await request(app).get('/limited')).status).toBe(429);
  });

  test('uses IP identity for shared-key callers without req.user', async () => {
    const app = express();
    app.get('/limited', createRequestLimiter({ prefix: 'test-ip', limit: 1 }), (_req, res) => res.sendStatus(204));
    expect((await request(app).get('/limited')).status).toBe(204);
    expect((await request(app).get('/limited')).status).toBe(429);
  });
});
