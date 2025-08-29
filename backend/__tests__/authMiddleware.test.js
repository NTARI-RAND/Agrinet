const { test } = require('node:test');
const assert = require('node:assert');
const auth = require('../middleware/authMiddleware');

function runMiddleware(headers) {
  return new Promise((resolve) => {
    const req = { headers };
    const res = { status: (code) => ({ json: (body) => resolve({ code, body }) }) };
    auth(req, res, () => resolve({ code: 0 }));
  });
}

test('allows request with matching API_KEY', async () => {
  process.env.API_KEY = 'test-key';
  const result = await runMiddleware({ 'x-api-key': 'test-key' });
  assert.equal(result.code, 0);
});

test('rejects request with invalid API key', async () => {
  process.env.API_KEY = 'test-key';
  const result = await runMiddleware({ 'x-api-key': 'bad' });
  assert.equal(result.code, 403);
});
