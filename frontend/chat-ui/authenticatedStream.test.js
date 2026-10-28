const { test } = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');

test('stream authenticates by header and parses fragmented CRLF token/message events', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const { authenticatedStream } = await import('./src/authenticatedStream.mjs');
  const client = createAccountClient({ baseUrl: 'https://backend.example' });
  client.setToken('alice-token');
  let headers;
  let destination;
  const encoder = new TextEncoder();
  const stream = authenticatedStream(client, '/stream/mine', { fetchImpl: async (url, options) => {
    headers = options.headers;
    destination = url;
    return new Response(new ReadableStream({ start(controller) {
      for (const chunk of ['event: to', 'ken\r', '\ndata: {"token":"hello"}\r\n\r', '\nevent: message\ndata: {"message":{"id":"answer"}}\n\n']) controller.enqueue(encoder.encode(chunk));
    } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  const tokens = [];
  stream.addEventListener('token', event => tokens.push(JSON.parse(event.data).token));
  const [message] = await once(stream, 'message');
  assert.deepEqual(tokens, ['hello']);
  assert.equal(JSON.parse(message.data).message.id, 'answer');
  assert.equal(headers.Authorization, 'Bearer alice-token');
  assert.equal(destination, 'https://backend.example/stream/mine');
  stream.close();
});

test('account change aborts and closes the old stream before later frames dispatch', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const { authenticatedStream } = await import('./src/authenticatedStream.mjs');
  const client = createAccountClient();
  client.setToken('alice-token');
  let signal;
  let cancelled = false;
  const stream = authenticatedStream(client, '/stream/mine', { fetchImpl: async (_url, options) => {
    signal = options.signal;
    return new Response(new ReadableStream({ cancel() { cancelled = true; } }), { headers: { 'Content-Type': 'text/event-stream' } });
  } });
  await once(stream, 'open');
  client.setToken('bob-token');
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(signal.aborted, true);
  assert.equal(cancelled, true);
  assert.equal(stream.readyState, 2);
});

test('authorization failures stop reconnecting and no token means no request', async () => {
  const { createAccountClient } = await import('./src/accountClient.mjs');
  const { authenticatedStream } = await import('./src/authenticatedStream.mjs');
  const client = createAccountClient();
  let requests = 0;
  const fetchImpl = async () => { requests++; return new Response('denied', { status: 401 }); };
  const anonymous = authenticatedStream(client, '/stream/mine', { fetchImpl });
  await once(anonymous, 'error');
  assert.equal(requests, 0);
  client.setToken('account-token');
  const denied = authenticatedStream(client, '/stream/mine', { fetchImpl });
  await once(denied, 'error');
  assert.equal(denied.readyState, 2);
  assert.equal(requests, 1);
});
