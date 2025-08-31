const { test } = require('node:test');
const assert = require('node:assert');
const Message = require('../models/message');

test('sendMessage stores and listMessages retrieves', async () => {
  const store = [];
  const mockClient = {
    put: ({ Item }) => ({ promise: async () => { store.push(Item); } }),
    query: ({ ExpressionAttributeValues }) => ({
      promise: async () => ({ Items: store.filter(i => i.conversationId === ExpressionAttributeValues[':cid']) }),
    }),
    batchWrite: () => ({ promise: async () => {} }),
  };
  Message.setDocClient(mockClient);
  const msg = await Message.sendMessage('c1', { from: 'u1', to: 'u2', content: 'hello' });
  assert.ok(msg.id);
  const list = await Message.listMessages('c1');
  assert.strictEqual(list[0].content, 'hello');
});

