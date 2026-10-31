const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const request = require('supertest');
const fs = require('node:fs');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const jwt = require('../utils/jwt');
const docClient = require('../lib/dynamodbClient');
const Message = require('../models/message');
const { setClient, resetClient } = require('../lib/openaiClient');

// Only the external DynamoDB boundary is replaced. Real routes, auth,
// controller, message persistence and AI streaming run in these tests.
function memoryDatabase() {
  const tables = new Map();
  const clone = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
  const table = name => {
    if (!tables.has(name)) tables.set(name, new Map());
    return tables.get(name);
  };
  const key = item => JSON.stringify([item.conversationId || null, item.id]);
  const conditionalError = () => Object.assign(new Error('condition failed'), { code: 'ConditionalCheckFailedException' });
  return {
    tables,
    put: params => ({ promise: async () => {
      const rows = table(params.TableName);
      if (params.ConditionExpression && rows.has(key(params.Item))) throw conditionalError();
      rows.set(key(params.Item), clone(params.Item));
      return {};
    } }),
    get: params => ({ promise: async () => ({ Item: clone(table(params.TableName).get(key(params.Key))) }) }),
    update: params => ({ promise: async () => {
      const row = table(params.TableName).get(key(params.Key));
      const values = params.ExpressionAttributeValues;
      if (!row || row.state !== values[':processing'] || row.fingerprint !== values[':fingerprint']) throw conditionalError();
      row.state = values[':complete'];
      row.outcome = clone(values[':outcome']);
      return {};
    } }),
    query: params => ({ promise: async () => ({ Items: [...table(params.TableName).values()]
      .filter(row => row.conversationId === params.ExpressionAttributeValues[':cid']).map(clone) }) }),
    batchWrite: params => ({ promise: async () => {
      for (const [name, writes] of Object.entries(params.RequestItems)) {
        for (const { DeleteRequest } of writes) table(name).delete(key(DeleteRequest.Key));
      }
      return {};
    } }),
  };
}

let db, app, originalClient, originalEnv, aiCalls, emitted;
const payload = { from: 'user', to: 'ai', content: 'When should I plant tomatoes?', type: 'text' };

function makeApp() {
  const instance = express();
  instance.use(express.json());
  instance.use('/messages', require('../routes/communicationRoutes'));
  return instance;
}

function send({ key = 'send-1', body = payload, user = 'grower-1', conversation = 'conversation-1', apiKey } = {}) {
  let pending = request(app).post(`/messages/${conversation}`);
  if (apiKey) pending = pending.set('X-API-Key', apiKey);
  else pending = pending.set('Authorization', `Bearer ${jwt.sign({ userId: user }, process.env.JWT_SECRET)}`);
  if (key !== undefined && key !== null) pending = pending.set('Idempotency-Key', key);
  return pending.send(body);
}

function messages() { return [...(db.tables.get('Messages')?.values() || [])]; }

beforeEach(() => {
  originalEnv = { JWT_SECRET: process.env.JWT_SECRET, API_KEY: process.env.API_KEY };
  process.env.JWT_SECRET = 'test-only-message-retry-secret';
  process.env.API_KEY = 'test-only-api-key';
  db = memoryDatabase();
  originalClient = { ...docClient };
  Object.assign(docClient, db);
  Message.setDocClient(docClient);
  aiCalls = 0;
  emitted = [];
  global.emitMessage = (conversation, message) => emitted.push({ conversation, message });
  setClient({ chat: { completions: { create: async () => {
    aiCalls++;
    return (async function* () { yield { choices: [{ delta: { content: 'Plant after the last frost.' } }] }; })();
  } } } });
  app = makeApp();
});

afterEach(() => {
  Object.assign(docClient, originalClient);
  Message.setDocClient(docClient);
  resetClient();
  delete global.emitMessage;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key]; else process.env[key] = value;
  }
});

test('retries return the original message and AI reply without repeating side effects', async () => {
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 201);
  assert.equal(retry.status, 201);
  assert.deepEqual(retry.body, first.body);
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 1);
  assert.equal(emitted.length, 2);
});

test('reusing a key with different content conflicts without creating another message', async () => {
  const first = await send();
  const changed = await send({ body: { ...payload, content: 'A different question' } });
  assert.equal(first.status, 201);
  assert.equal(changed.status, 409);
  assert.equal(changed.body.code, 'idempotency_key_conflict');
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 1);
});

test('keys are isolated by authenticated caller and conversation, never by body.from', async () => {
  const first = await send();
  const otherUser = await send({ user: 'grower-2' });
  const otherConversation = await send({ conversation: 'conversation-2' });
  assert.equal(otherUser.status, 201);
  assert.equal(otherConversation.status, 201);
  assert.notEqual(otherUser.body.message.id, first.body.message.id);
  assert.notEqual(otherConversation.body.message.id, first.body.message.id);
  assert.deepEqual((await send()).body, first.body);
  assert.equal(messages().length, 6);
});

test('requests without a key keep the existing new-send behavior', async () => {
  const first = await send({ key: null });
  const next = await send({ key: null });
  assert.equal(first.status, 201);
  assert.equal(next.status, 201);
  assert.notEqual(first.body.message.id, next.body.message.id);
  assert.equal(messages().length, 4);
});

test('invalid keys are rejected before persistence or AI work', async () => {
  for (const key of ['', 'key with spaces', 'x'.repeat(129)]) {
    const result = await send({ key });
    assert.equal(result.status, 400);
  }
  assert.equal(messages().length, 0);
  assert.equal(aiCalls, 0);
});

for (const apiCaller of [false, true]) {
  test(`parallel ${apiCaller ? 'API-key' : 'JWT'} retries cannot acquire a second send while the first AI response is running`, async () => {
    const auth = apiCaller ? { apiKey: process.env.API_KEY } : {};
    let started, finish;
    const running = new Promise(resolve => { started = resolve; });
    const release = new Promise(resolve => { finish = resolve; });
    setClient({ chat: { completions: { create: async () => {
      aiCalls++;
      started();
      await release;
      return (async function* () { yield { choices: [{ delta: { content: 'Ready' } }] }; })();
    } } } });
    const first = send(auth).then(response => response);
    await running;
    const racing = await Promise.all(Array.from({ length: 8 }, () => send(auth)));
    finish();
    const done = await first;
    assert.ok(racing.every(response => response.status === 409 && response.body.code === 'message_send_pending'));
    assert.deepEqual((await send(auth)).body, done.body);
    assert.equal(messages().length, 2);
    assert.equal(aiCalls, 1);
    assert.equal(emitted.length, 2);
  });
}

test('completed receipts survive reloading the request handler', async () => {
  const first = await send();
  for (const name of ['../services/retrySafeMessage', '../models/messageSend', '../controllers/communication_controller', '../routes/communicationRoutes']) {
    delete require.cache[require.resolve(name)];
  }
  app = makeApp();
  assert.deepEqual((await send()).body, first.body);
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 1);
});

test('omitting the default type or reordering JSON fields still replays the same send', async () => {
  const first = await send();
  const retry = await send({ body: { content: payload.content, to: 'ai', from: 'user' } });
  assert.deepEqual(retry.body, first.body);
  assert.equal(aiCalls, 1);
});

test('changing sender label, recipient, type or attachment conflicts, without rerunning work', async () => {
  await send();
  for (const changed of [{ from: 'farmer' }, { to: 'another' }, { type: 'file' },
    { file: { name: 'note.txt', type: 'text/plain', data: 'aGVsbG8=' } }]) {
    const result = await send({ body: { ...payload, ...changed } });
    assert.equal(result.status, 409);
    assert.equal(result.body.code, 'idempotency_key_conflict');
  }
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 1);
});

test('API-key callers replay within their credential scope and do not share JWT receipts', async () => {
  const first = await send({ apiKey: process.env.API_KEY });
  assert.deepEqual((await send({ apiKey: process.env.API_KEY })).body, first.body);
  const user = await send();
  assert.equal(user.status, 201);
  assert.notEqual(user.body.message.id, first.body.message.id);
  assert.equal(aiCalls, 2);
});

test('API-key receipts use the stable scrypt scope instead of a fast credential hash', async () => {
  const first = await send({ apiKey: process.env.API_KEY });
  assert.equal(first.status, 201);
  const [receipt] = db.tables.get('MessageSends').values();
  // Independent Python hashlib.scrypt fixture: password=test-only-api-key,
  // salt=SHA256(JSON([message-send-api-key-v2, conversation-1, send-1])).hex,
  // N=16384, r=8, p=5, dklen=32. Locks the durable replay namespace.
  assert.equal(receipt.id, 'e54be044e9e970d309de6ebe2b3763f1cbb49c546d04c7379102ba52709867e6');
  assert.ok(!JSON.stringify(receipt).includes(process.env.API_KEY));
  delete require.cache[require.resolve('../services/retrySafeMessage')];
  delete require.cache[require.resolve('../controllers/communication_controller')];
  delete require.cache[require.resolve('../routes/communicationRoutes')];
  app = makeApp();
  assert.deepEqual((await send({ apiKey: process.env.API_KEY })).body, first.body);
  assert.equal(aiCalls, 1);
});

test('API-key rotation, conversation and send keys have separate retry scopes', async () => {
  const first = await send({ apiKey: process.env.API_KEY });
  const otherConversation = await send({ apiKey: process.env.API_KEY, conversation: 'conversation-2' });
  const otherSend = await send({ apiKey: process.env.API_KEY, key: 'send-2' });
  process.env.API_KEY = 'rotated-test-api-key';
  const rotated = await send({ apiKey: process.env.API_KEY });
  for (const response of [first, otherConversation, otherSend, rotated]) assert.equal(response.status, 201);
  assert.equal(new Set([first, otherConversation, otherSend, rotated].map(response => response.body.message.id)).size, 4);
  assert.deepEqual((await send({ apiKey: process.env.API_KEY })).body, rotated.body);
  assert.equal(aiCalls, 4);
});

test('WIX API-key retries work without a JWT secret', async () => {
  const priorWixKey = process.env.WIX_API_KEY;
  delete process.env.API_KEY;
  delete process.env.JWT_SECRET;
  process.env.WIX_API_KEY = 'test-only-wix-api-key';
  try {
    const first = await send({ apiKey: process.env.WIX_API_KEY });
    assert.equal(first.status, 201);
    assert.deepEqual((await send({ apiKey: process.env.WIX_API_KEY })).body, first.body);
    assert.equal(aiCalls, 1);
  } finally {
    if (priorWixKey === undefined) delete process.env.WIX_API_KEY; else process.env.WIX_API_KEY = priorWixKey;
  }
});

test('an invalid API-key header cannot alter a verified JWT retry scope', async () => {
  const first = await send();
  const retry = await request(app).post('/messages/conversation-1')
    .set('Authorization', `Bearer ${jwt.sign({ userId: 'grower-1' }, process.env.JWT_SECRET)}`)
    .set('X-API-Key', 'invalid-api-key')
    .set('Idempotency-Key', 'send-1').send(payload);
  assert.equal(retry.status, 201);
  assert.deepEqual(retry.body, first.body);
  assert.equal(aiCalls, 1);
});

test('authentication failures and JWTs without a stable user ID create no receipts', async () => {
  assert.equal((await request(app).post('/messages/conversation-1').set('Idempotency-Key', 'key').send(payload)).status, 403);
  const noIdentity = await request(app).post('/messages/conversation-1')
    .set('Authorization', `Bearer ${jwt.sign({ role: 'member' }, process.env.JWT_SECRET)}`)
    .set('Idempotency-Key', 'key').send(payload);
  assert.equal(noIdentity.status, 400);
  assert.equal(db.tables.size, 0);
});

test('deleting a conversation never lets an old retry resurrect its messages or retained narrative', async () => {
  await send();
  await Message.removeByConversation('conversation-1');
  const retry = await send();
  assert.equal(retry.status, 410);
  assert.equal(retry.body.code, 'message_send_removed');
  assert.equal(messages().length, 0);
  const receipts = JSON.stringify([...(db.tables.get('MessageSends')?.values() || [])]);
  assert.ok(!receipts.includes(payload.content));
  assert.ok(!receipts.includes('Plant after the last frost.'));
  assert.ok(!receipts.includes('grower-1'));
  assert.ok(!receipts.includes('send-1'));
  assert.equal(aiCalls, 1);
});


test('a missing persisted assistant reply cannot replay a partial success', async () => {
  const first = await send();
  assert.equal(first.status, 201);
  const [replyKey] = [...db.tables.get('Messages')].find(([, row]) => row.id === first.body.reply.id);
  db.tables.get('Messages').delete(replyKey);
  const retry = await send();
  assert.equal(retry.status, 410);
  assert.equal(retry.body.code, 'message_send_removed');
  assert.equal(messages().length, 1);
  assert.equal(aiCalls, 1);
});

test('a missing receipt table refuses keyed sends before any message or AI work', async () => {
  const put = docClient.put;
  docClient.put = params => params.TableName === 'MessageSends'
    ? { promise: async () => { throw Object.assign(new Error('missing table'), { code: 'ResourceNotFoundException' }); } }
    : put(params);
  const result = await send();
  assert.equal(result.status, 503);
  assert.equal(result.body.code, 'message_send_unavailable');
  assert.equal(messages().length, 0);
  assert.equal(aiCalls, 0);
  assert.equal((await send({ key: null })).status, 201);
});

test('an acknowledged message followed by a delivery failure is not sent again on retry', async () => {
  docClient.query = () => ({ promise: async () => { throw new Error('history storage unavailable'); } });
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 500);
  assert.equal(first.body.code, 'message_send_failed');
  assert.equal(retry.status, 500);
  assert.deepEqual(retry.body, first.body);
  assert.equal(messages().length, 1);
  assert.equal(emitted.length, 1);
  assert.equal(aiCalls, 0);
});

test('failure to record completion leaves a durable pending receipt instead of rerunning AI', async () => {
  docClient.update = () => ({ promise: async () => { throw new Error('receipt update timeout'); } });
  const first = await send();
  const retry = await send();
  assert.equal(first.status, 503);
  assert.equal(first.body.code, 'message_send_uncertain');
  assert.equal(retry.status, 409);
  assert.equal(retry.body.code, 'message_send_pending');
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 1);
});

test('attachment retries reuse one file and do not call an AI responder', async (t) => {
  const filename = `retry-${randomUUID()}.txt`;
  const uploads = path.join(__dirname, '../uploads');
  t.after(() => {
    for (const file of fs.readdirSync(uploads).filter(name => name.endsWith(filename))) fs.unlinkSync(path.join(uploads, file));
  });
  const body = { from: 'user', to: 'buyer', type: 'file',
    file: { name: filename, type: 'text/plain', data: Buffer.from('Pickup instructions').toString('base64') } };
  const first = await send({ body });
  const replay = await send({ body });
  assert.equal(first.status, 201);
  assert.deepEqual(replay.body, first.body);
  assert.equal(fs.readFileSync(path.join(__dirname, '..', first.body.message.file.path), 'utf8'), 'Pickup instructions');
  assert.equal(fs.readdirSync(uploads).filter(name => name.endsWith(filename)).length, 1);
  assert.equal(messages().length, 1);
  assert.equal(aiCalls, 0);
});

test('a receipt-write timeout that actually committed never permits a duplicate send', async () => {
  const put = docClient.put;
  let loseAck = true;
  docClient.put = params => ({ promise: async () => {
    const result = await put(params).promise();
    if (params.TableName === 'MessageSends' && loseAck) {
      loseAck = false;
      throw new Error('acknowledgment lost after commit');
    }
    return result;
  } });
  assert.equal((await send()).status, 503);
  const retry = await send();
  assert.equal(retry.status, 409);
  assert.equal(retry.body.code, 'message_send_pending');
  assert.equal(messages().length, 0);
  assert.equal(aiCalls, 0);
});

test('Agrinet-specific replies are also reused without rebroadcasting', async () => {
  const body = { ...payload, content: 'Explain the federation node layout' };
  const first = await send({ body });
  assert.equal(first.body.reply.from, 'agrinet');
  assert.deepEqual((await send({ body })).body, first.body);
  assert.equal(messages().length, 2);
  assert.equal(aiCalls, 0);
  assert.equal(emitted.length, 2);
});

test('browser preflight permits the idempotency header on the existing allowed origin', async () => {
  const priorMinimal = process.env.MINIMAL_SERVER;
  process.env.MINIMAL_SERVER = 'true';
  try {
    const { app: serverApp } = require('../server');
    const response = await request(serverApp).options('/messages/conversation-1')
      .set('Origin', 'https://www.ntari.org')
      .set('Access-Control-Request-Method', 'POST')
      .set('Access-Control-Request-Headers', 'authorization,content-type,idempotency-key');
    assert.equal(response.status, 204);
    assert.ok(response.headers['access-control-allow-headers'].toLowerCase().split(',').includes('idempotency-key'));
  } finally {
    if (priorMinimal === undefined) delete process.env.MINIMAL_SERVER; else process.env.MINIMAL_SERVER = priorMinimal;
  }
});
