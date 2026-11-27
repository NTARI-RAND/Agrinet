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

test('setting the same token preserves pending requests and account state', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let finish;
  const client = createAccountClient({ fetchImpl: () => new Promise(resolve => { finish = resolve; }) });
  client.setToken('alice');
  let changes = 0;
  client.changes.addEventListener('change', () => changes++);
  const pending = client.request('GET', '/conversations');
  client.setToken('alice');
  finish(new Response('[]'));
  assert.deepEqual(await pending, []);
  assert.equal(changes, 0);
});

test('raw attachment names encode URL punctuation without decoding percent sequences', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const urls = [];
  const client = createAccountClient({ fetchImpl: async url => { urls.push(url); return new Response('file'); } });
  client.setToken('alice');
  for (const name of ['100%.txt', 'a#b?.txt', '%2e%2e.txt']) await client.attachment('/uploads/' + name, 'mine');
  assert.deepEqual(urls, ['/conversations/mine/attachments/100%25.txt', '/conversations/mine/attachments/a%23b%3F.txt', '/conversations/mine/attachments/%252e%252e.txt']);
  for (const name of ['..', '..\\x', '../x', '\0']) await assert.rejects(client.attachment('/uploads/' + name, 'mine'), /Invalid attachment path/);
  await assert.rejects(client.request('GET', '//evil.example/x'), /Invalid API path/);
});

test('401 clears expired account credentials and notifies the UI', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const client = createAccountClient({ fetchImpl: async () => new Response('{"error":"expired"}', { status: 401 }) });
  client.setToken('expired');
  let changes = 0;
  client.changes.addEventListener('change', () => changes++);
  await assert.rejects(client.request('GET', '/conversations'), error => error.status === 401);
  assert.equal(client.getToken(), null);
  assert.equal(changes, 1);
});

test('collection requests follow empty pages and retain the account and query filters', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const calls = [];
  const pages = [
    new Response('[]', { headers: { 'X-Next-Cursor': 'opaque-1' } }),
    new Response('[{"id":"mine"}]', { headers: { 'X-Next-Cursor': 'opaque-2' } }),
    new Response('[{"id":"also-mine"}]'),
  ];
  const client = createAccountClient({ fetchImpl: async (url, options) => {
    calls.push({ url, options });
    return pages.shift();
  } });
  client.setToken('alice-token');
  assert.deepEqual(await client.request('GET', '/conversations?limit=1'), [{ id: 'mine' }, { id: 'also-mine' }]);
  assert.deepEqual(calls.map(call => call.url), ['/conversations?limit=1', '/conversations?limit=1&cursor=opaque-1', '/conversations?limit=1&cursor=opaque-2']);
  assert.ok(calls.every(call => call.options.headers.Authorization === 'Bearer alice-token' && call.options.redirect === 'error'));
});

test('changing accounts between pages rejects the collection instead of returning a partial old-account result', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let finish;
  let calls = 0;
  const client = createAccountClient({ fetchImpl: async () => {
    if (++calls === 1) return new Response('[{"id":"alice-private"}]', { headers: { 'X-Next-Cursor': 'next' } });
    return new Promise(resolve => { finish = resolve; });
  } });
  client.setToken('alice-token');
  const pending = client.request('GET', '/conversations');
  for (let wait = 0; !finish && wait < 100; wait++) await new Promise(resolve => setImmediate(resolve));
  assert.equal(typeof finish, 'function', 'client must request the continuation page');
  client.setToken('bob-token');
  finish(new Response('[]'));
  await assert.rejects(pending, /Account changed/);
});

test('collection pagination refuses a repeated cursor and surfaces later HTTP failures', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  let calls = 0;
  const client = createAccountClient({ fetchImpl: async () => {
    calls++;
    return new Response('[]', { headers: { 'X-Next-Cursor': 'same' } });
  } });
  await assert.rejects(client.request('GET', '/conversations'), /cursor/);
  assert.equal(calls, 2);
  let attempt = 0;
  const failing = createAccountClient({ fetchImpl: async () => ++attempt === 1
    ? new Response('[{"id":"first"}]', { headers: { 'X-Next-Cursor': 'next' } })
    : new Response('{"error":"page failed"}', { status: 500 }) });
  await assert.rejects(failing.request('GET', '/conversations'), /page failed/);
});
