const { test } = require('node:test');
const assert = require('node:assert/strict');

test('account requests carry bearer headers without putting credentials in URLs', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let received;
  const client = createAccountClient({ baseUrl: 'https://backend.example', fetchImpl: async (url, options) => {
    received = { url, options };
    return new Response('{"id":"owned"}', { status: 201 });
  } });
  client.setToken('account-token');
  assert.deepEqual(await client.request('POST', '/conversations', { title: 'mine' }), { id: 'owned' });
  assert.equal(received.url, 'https://backend.example/conversations');
  assert.equal(received.options.headers.Authorization, 'Bearer account-token');
  assert.equal(received.options.redirect, 'error');
  assert.equal(received.options.body, '{"title":"mine"}');
});

test('clearing or changing accounts discards in-flight account responses', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let finish;
  const client = createAccountClient({ fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  client.setToken('alice-token');
  const pending = client.request('GET', '/messages/private');
  client.setToken('bob-token');
  finish(new Response('[{"content":"alice secret"}]'));
  await assert.rejects(pending, /Account changed/);
  client.setToken(null);
  assert.equal(client.getToken(), null);
});

test('attachment downloads use the same account and reject credential destinations outside uploads', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let received;
  const client = createAccountClient({ fetchImpl: async (url, options) => {
    received = { url, options };
    return new Response('private file');
  } });
  client.setToken('owner-token');
  const blob = await client.attachment('/uploads/file.txt');
  assert.equal(await blob.text(), 'private file');
  assert.equal(received.options.headers.Authorization, 'Bearer owner-token');
  for (const url of ['https://attacker.example/x', '//attacker.example/x', '/uploads/../users', '/uploads/%2e%2e/users']) {
    await assert.rejects(client.attachment(url), /Invalid attachment path/);
  }
  client.setToken(null);
  await assert.rejects(client.attachment('/uploads/file.txt'), /Sign in/);
});
