const express = require('express');
const request = require('supertest');
const jwt = require('jsonwebtoken');
const chatAuth = require('../chatAuth');

describe('private chat authentication', () => {
  const prior = process.env.JWT_SECRET;
  beforeAll(() => { process.env.JWT_SECRET = 'chat-auth-test-secret'; });
  afterAll(() => {
    if (prior === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = prior;
  });

  function app() {
    const server = express();
    server.get('/private', chatAuth, (req, res) => res.json({ userId: req.user.userId }));
    return server;
  }

  test('rejects shared API-key-only requests', async () => {
    const response = await request(app()).get('/private').set('x-api-key', 'browser-key');
    expect(response.status).toBe(401);
  });

  test('rejects missing and invalid bearer tokens', async () => {
    expect((await request(app()).get('/private')).status).toBe(401);
    expect((await request(app()).get('/private').set('Authorization', 'Bearer invalid')).status).toBe(401);
  });

  test('accepts a signed account token and sets its principal', async () => {
    const token = jwt.sign({ userId: 'member-1', role: 'consumer' }, process.env.JWT_SECRET, { expiresIn: '5m' });
    const response = await request(app()).get('/private').set('Authorization', 'Bearer ' + token);
    expect(response.status).toBe(200);
    expect(response.body).toEqual({ userId: 'member-1' });
  });
});
