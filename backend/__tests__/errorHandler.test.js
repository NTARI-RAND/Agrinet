const { test } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const errorHandler = require('../middleware/errorHandler');

function loadMinimalServer(t) {
  const priorMinimal = process.env.MINIMAL_SERVER;
  process.env.MINIMAL_SERVER = 'true';
  t.after(() => {
    if (priorMinimal === undefined) delete process.env.MINIMAL_SERVER; else process.env.MINIMAL_SERVER = priorMinimal;
  });
  return require('../server').app;
}

test('a refused CORS origin gets a JSON 403, not an error page', async (t) => {
  const app = loadMinimalServer(t);
  const response = await request(app).get('/health').set('Origin', 'https://elsewhere.example');
  assert.equal(response.status, 403);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(response.body, { error: 'CORS not allowed for this origin' });
});

test('a malformed JSON body gets a JSON 400 without a stack trace', async (t) => {
  const app = loadMinimalServer(t);
  const response = await request(app).post('/health')
    .set('Content-Type', 'application/json').send('{"broken":');
  assert.equal(response.status, 400);
  assert.match(response.headers['content-type'], /application\/json/);
  assert.deepEqual(Object.keys(response.body), ['error']);
  assert.doesNotMatch(response.text, /\bat \S+ \(|node_modules|[\\/]backend[\\/]/);
});

test('an unexpected error gets a generic JSON 500', async (t) => {
  const originalError = console.error;
  console.error = () => {};
  t.after(() => { console.error = originalError; });
  const app = express();
  app.get('/boom', () => { throw new Error('secret detail at /srv/app/backend/x.js'); });
  app.use(errorHandler);
  const response = await request(app).get('/boom');
  assert.equal(response.status, 500);
  assert.deepEqual(response.body, { error: 'Internal Server Error' });
});

test('a client error that is not marked safe to show keeps only its status text', async () => {
  const app = express();
  app.get('/teapot', (_req, _res, next) => next(Object.assign(new Error('internal reason'), { status: 418 })));
  app.use(errorHandler);
  const response = await request(app).get('/teapot');
  assert.equal(response.status, 418);
  assert.deepEqual(response.body, { error: "I'm a Teapot" });
});
