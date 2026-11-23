const { test } = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const streams = require('../lib/conversationStreams');
const Conversation = require('../models/conversation');
const Message = require('../models/message');
const dynamo = require('../lib/dynamodbClient');
const controller = require('../controllers/communication_controller');
const { setClient, resetClient } = require('../lib/openaiClient');

function streamResponse(frames) {
  const res = new EventEmitter();
  res.status = () => res;
  res.set = () => res;
  res.flushHeaders = () => {};
  res.write = frame => frames.push(frame);
  res.end = () => { res.writableEnded = true; res.emit('close'); };
  return res;
}

async function checkDelivery(t, canonical) {
  const originalOwner = Conversation.getOwned;
  const originalGlobals = Object.fromEntries(['broadcast', 'emitToken', 'emitMessage'].map(key => [key, global[key]]));
  const frames = [];
  const saved = [];
  const id = canonical ? 'canonical-delivery' : 'legacy-delivery';
  t.after(() => {
    streams.close(id);
    Conversation.getOwned = originalOwner;
    Message.setDocClient(dynamo);
    resetClient();
    for (const [key, value] of Object.entries(originalGlobals)) {
      if (value === undefined) delete global[key]; else global[key] = value;
    }
  });
  Conversation.getOwned = async () => ({ id, ownerId: 'alice' });
  Message.setDocClient({
    put: ({ Item }) => ({ promise: async () => { saved.push(Item); return {}; } }),
    query: () => ({ promise: async () => ({ Items: saved }) }),
  });
  setClient({ chat: { completions: { create: async () => (async function* () {
    for (const content of ['Hello', ' ', 'world!']) yield { choices: [{ delta: { content } }] };
  }()) } } });
  global.emitToken = (conversationId, responseId, token) => streams.send(conversationId, 'token', { id: responseId, token });
  global.emitMessage = (conversationId, message) => streams.send(conversationId, 'message', { message });
  if (canonical) global.broadcast = (event, data, conversationId) => streams.send(conversationId, event, data);
  else delete global.broadcast;
  await streams.open({ user: { userId: 'alice', exp: Math.ceil(Date.now() / 1000) + 60 }, params: { conversationId: id } }, streamResponse(frames));
  const result = { status() { return this; }, json(body) { this.body = body; } };
  await controller.sendMessage({ params: { conversationId: id }, body: { from: 'user', content: 'How are you?', type: 'text' } }, result);
  const tokens = frames.filter(frame => frame.startsWith('event: token\n')).map(frame => JSON.parse(frame.split('\n')[1].slice(6)));
  const messages = frames.filter(frame => frame.startsWith('event: message\n')).map(frame => JSON.parse(frame.split('\n')[1].slice(6)).message.id);
  assert.deepEqual(tokens.map(token => token.token), ['Hello', ' ', 'world!'], 'each streamed token must have one SSE frame');
  assert(tokens.every(token => token.id === result.body.ai.id));
  assert.deepEqual(messages, [result.body.message.id, result.body.ai.id], 'each persisted message must have one SSE frame');
}

test('canonical and legacy aliases produce one frame per token and message', async t => {
  await t.test('canonical broadcast present', t => checkDelivery(t, true));
  await t.test('legacy aliases only', t => checkDelivery(t, false));
});
