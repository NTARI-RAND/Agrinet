const { test, beforeEach, afterEach } = require('node:test');
const assert = require('node:assert/strict');
const Message = require('../../models/message');
const commController = require('../../controllers/communication_controller');
const dynamoClient = require('../../lib/dynamodbClient');
const { setClient, resetClient } = require('../../lib/openaiClient');

let storedMessages;

beforeEach(() => {
  storedMessages = [];
  Message.setDocClient({
    put: ({ Item }) => ({
      promise: async () => {
        storedMessages.push(Item);
      },
    }),
    query: ({ ExpressionAttributeValues }) => ({
      promise: async () => ({
        Items: storedMessages.filter(
          (item) => item.conversationId === ExpressionAttributeValues[':cid']
        ),
      }),
    }),
    batchWrite: () => ({ promise: async () => {} }),
  });
});

afterEach(() => {
  Message.setDocClient(dynamoClient);
  resetClient();
  delete global.broadcast;
  delete global.emitToken;
  delete global.emitMessage;
});

function createStream(chunks) {
  return {
    async *[Symbol.asyncIterator]() {
      for (const content of chunks) {
        yield { choices: [{ delta: { content } }] };
      }
    },
  };
}

test('sendMessage streams tokens and persists ai message', async () => {
  const tokenEvents = [];
  const messageEvents = [];

  global.broadcast = (event, payload, conversationId) => {
    if (event === 'token') {
      tokenEvents.push({ conversationId, ...payload });
    }
    if (event === 'message') {
      messageEvents.push({ conversationId, ...payload });
    }
  };

  const directTokens = [];
  global.emitToken = (_conversationId, _id, token) => {
    directTokens.push(token);
  };
  global.emitMessage = (_conversationId, message) => {
    messageEvents.push({ message });
  };

  const mockClient = {
    chat: {
      completions: {
        create: async () => createStream(['Hello', ' ', 'world!']),
      },
    },
  };
  setClient(mockClient);

  const req = {
    params: { conversationId: 'conv1' },
    body: { from: 'user', to: 'ai', content: 'How are you?', type: 'text' },
  };

  let statusCode;
  let jsonResponse;
  const res = {
    status(code) {
      statusCode = code;
      return this;
    },
    json(body) {
      jsonResponse = body;
    },
  };

  await commController.sendMessage(req, res);

  assert.equal(statusCode, 201);
  assert.ok(jsonResponse.message);
  assert.ok(jsonResponse.ai);
  assert.equal(storedMessages.length, 2);
  const aiMessage = storedMessages.find((msg) => msg.from === 'ai');
  assert.equal(aiMessage.content, 'Hello world!');
  assert.equal(jsonResponse.ai.id, aiMessage.id);

  assert.equal(tokenEvents.length, 3);
  assert.deepEqual(directTokens, ['Hello', ' ', 'world!']);
  assert(tokenEvents.every((event) => event.id === aiMessage.id));

  assert.ok(
    messageEvents.some((event) => event.message && event.message.id === aiMessage.id)
  );
});
