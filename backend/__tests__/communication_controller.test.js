const { test } = require('node:test');
const assert = require('node:assert');

const controller = require('../controllers/communication_controller');
const Message = require('../models/message');
const agrinetResponder = require('../services/agrinetResponder');
const openAIResponder = require('../services/openAIResponder');

function createResponseMock() {
  return {
    statusCode: null,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(payload) {
      this.body = payload;
      return this;
    },
  };
}

function setupMessageStore() {
  const store = [];
  Message.sendMessage = async (conversationId, payload) => {
    const msg = {
      id: String(store.length + 1),
      conversationId,
      timestamp: new Date().toISOString(),
      ...payload,
    };
    if (!msg.type) msg.type = 'text';
    store.push(msg);
    return msg;
  };

  Message.listMessages = async () => store.slice();
  return store;
}

test('agrinet responder intercepts Agrinet-specific questions', async () => {
  const store = setupMessageStore();

  const originalShouldHandle = agrinetResponder.shouldHandle;
  const originalGenerateResponse = agrinetResponder.generateResponse;
  const originalOpenAIResponse = openAIResponder.generateResponse;
  const originalBroadcast = global.broadcast;
  const originalEmit = global.emitMessage;

  let openAICalled = false;
  let agrinetCalled = false;
  const broadcastEvents = [];
  const emitted = [];

  try {
    agrinetResponder.shouldHandle = (text) => {
      agrinetCalled = true;
      return originalShouldHandle(text);
    };

    agrinetResponder.generateResponse = async ({ message }) => ({
      from: 'agrinet',
      to: message.from,
      content: 'Agrinet answer ready',
    });

    openAIResponder.generateResponse = async () => {
      openAICalled = true;
      return { from: 'assistant', content: 'Should not be used' };
    };

    global.broadcast = (event, payload, conversationId) => {
      broadcastEvents.push({ event, payload, conversationId });
    };

    global.emitMessage = (conversationId, message) => {
      emitted.push({ conversationId, message });
    };

    const req = {
      params: { conversationId: 'conv-1' },
      body: {
        from: 'user',
        to: 'assistant',
        type: 'text',
        content: 'Can you explain the federation node layout?',
      },
    };

    const res = createResponseMock();
    await controller.sendMessage(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.reply, 'expected a reply');
    assert.strictEqual(store.length, 2, 'user + agrinet reply should be stored');
    assert.strictEqual(store[1].from, 'agrinet');
    assert.strictEqual(res.body.reply.content, 'Agrinet answer ready');
    assert.strictEqual(openAICalled, false, 'OpenAI flow should be skipped');
    assert.strictEqual(agrinetCalled, true, 'Agrinet guard should evaluate');
    const messageBroadcasts = broadcastEvents.filter((evt) => evt.payload.type === 'message');
    assert.strictEqual(messageBroadcasts.length, 2, 'both messages should be broadcast');
    assert.strictEqual(emitted.length, 2, 'emitMessage should fire for both messages');
  } finally {
    agrinetResponder.shouldHandle = originalShouldHandle;
    agrinetResponder.generateResponse = originalGenerateResponse;
    openAIResponder.generateResponse = originalOpenAIResponse;
    global.broadcast = originalBroadcast;
    global.emitMessage = originalEmit;
  }
});

test('OpenAI responder handles general messages', async () => {
  const store = setupMessageStore();

  const originalShouldHandle = agrinetResponder.shouldHandle;
  const originalGenerateResponse = agrinetResponder.generateResponse;
  const originalOpenAIResponse = openAIResponder.generateResponse;
  const originalBroadcast = global.broadcast;
  const originalEmit = global.emitMessage;

  let guardChecked = false;
  let openAICalled = false;

  try {
    agrinetResponder.shouldHandle = () => {
      guardChecked = true;
      return false;
    };

    agrinetResponder.generateResponse = async () => ({
      from: 'agrinet',
      content: 'Should not be used',
    });

    openAIResponder.generateResponse = async ({ message }) => {
      openAICalled = true;
      return {
        from: 'assistant',
        to: message.from,
        content: 'OpenAI reply',
      };
    };

    global.broadcast = () => {};
    global.emitMessage = () => {};

    const req = {
      params: { conversationId: 'conv-2' },
      body: {
        from: 'user',
        to: 'assistant',
        type: 'text',
        content: 'Tell me about soil sensors',
      },
    };

    const res = createResponseMock();
    await controller.sendMessage(req, res);

    assert.strictEqual(res.statusCode, 201);
    assert.ok(res.body.reply);
    assert.strictEqual(res.body.reply.content, 'OpenAI reply');
    assert.strictEqual(store.length, 2);
    assert.strictEqual(store[1].from, 'assistant');
    assert.strictEqual(guardChecked, true);
    assert.strictEqual(openAICalled, true);
  } finally {
    agrinetResponder.shouldHandle = originalShouldHandle;
    agrinetResponder.generateResponse = originalGenerateResponse;
    openAIResponder.generateResponse = originalOpenAIResponse;
    global.broadcast = originalBroadcast;
    global.emitMessage = originalEmit;
  }
});
