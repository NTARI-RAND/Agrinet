const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const Conversation = require('../models/conversation');
const streams = require('../lib/conversationStreams');

function response() {
  return Object.assign(new EventEmitter(), {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; this.end(); return this; },
    set() { return this; }, flushHeaders() {}, write() {},
    end() { this.writableEnded = true; this.emit('close'); },
  });
}
function request(id, userId = 'alice') {
  return { params: { conversationId: id }, user: { userId, exp: Math.ceil(Date.now() / 1000) + 60 } };
}

test('stream capacity is shared across conversations and renewed tokens, isolated by account, and reusable after close', async () => {
  Conversation.setDocClient({ get: ({ Key }) => ({ promise: async () => ({ Item: { id: Key.id, ownerId: Key.id.startsWith('bob') ? 'bob' : 'alice' } }) }) });
  const connections = [];
  try {
    for (let i = 0; i < 5; i++) {
      const res = response(); connections.push(res);
      await streams.open(request(`alice-${i}`), res);
      assert.equal(res.statusCode, 200);
    }
    const denied = response(); connections.push(denied);
    await streams.open(request('sixth'), denied);
    assert.equal(denied.statusCode, 429);
    const bob = response(); connections.push(bob);
    await streams.open(request('bob-1', 'bob'), bob);
    assert.equal(bob.statusCode, 200);
    connections[0].end();
    connections[0].emit('error', new Error('duplicate cleanup'));
    const replacement = response(); connections.push(replacement);
    await streams.open(request('replacement'), replacement);
    assert.equal(replacement.statusCode, 200);
    const stillFull = response(); connections.push(stillFull);
    await streams.open(request('still-full'), stillFull);
    assert.equal(stillFull.statusCode, 429);
  } finally { for (const res of connections) res.end(); }
});

test('pending ownership reads reserve capacity and deletion releases it before the database returns', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  Conversation.setDocClient({ get: ({ Key }) => ({ promise: async () => { await wait; return { Item: { id: Key.id, ownerId: 'alice' } }; } }) });
  const connections = Array.from({ length: 5 }, response);
  const pending = connections.map((res, index) => streams.open(request(`pending-${index}`), res));
  try {
    const denied = response(); connections.push(denied);
    await Promise.race([streams.open(request('pending-sixth'), denied), new Promise(resolve => setTimeout(resolve, 100))]);
    assert.equal(denied.statusCode, 429);
    streams.close('pending-0');
    const replacement = response(); connections.push(replacement);
    const next = streams.open(request('replacement'), replacement);
    release();
    await Promise.all([...pending, next]);
    assert.equal(connections[0].statusCode, 404);
    assert.equal(replacement.statusCode, 200);
  } finally { release(); await Promise.allSettled(pending); for (const res of connections) res.end(); }
});

test('failed ownership checks never consume account stream capacity', async () => {
  let fail = true;
  Conversation.setDocClient({ get: () => ({ promise: async () => { if (fail) throw new Error('database unavailable'); return {}; } }) });
  for (let i = 0; i < 6; i++) await assert.rejects(streams.open(request('failed'), response()), /database unavailable/);
  fail = false;
  for (let i = 0; i < 6; i++) {
    const res = response();
    await streams.open(request('missing'), res);
    assert.equal(res.statusCode, 404);
  }
});

test('token expiry closes pending reads and frees slots for a renewed token before database recovery', async () => {
  let release;
  const wait = new Promise(resolve => { release = resolve; });
  Conversation.setDocClient({ get: ({ Key }) => ({ promise: async () => {
    if (Key.id !== 'renewed') await wait;
    return { Item: { id: Key.id, ownerId: 'alice' } };
  } }) });
  const exp = Math.ceil(Date.now() / 1000) + 1;
  const connections = Array.from({ length: 5 }, response);
  const pending = connections.map((res, index) => streams.open({ ...request(`expiring-${index}`), user: { userId: 'alice', exp } }, res));
  try {
    await new Promise(resolve => setTimeout(resolve, exp * 1000 - Date.now() + 30));
    assert.ok(connections.every(res => res.writableEnded && res.statusCode === 401));
    const renewed = response(); connections.push(renewed);
    await streams.open(request('renewed'), renewed);
    assert.equal(renewed.statusCode, 200);
    release();
    await Promise.all(pending);
    assert.ok(connections.slice(0, 5).every(res => res.statusCode === 401));
  } finally { release(); await Promise.allSettled(pending); for (const res of connections) res.end(); }
});
