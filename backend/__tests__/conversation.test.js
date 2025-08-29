const { test } = require('node:test');
const assert = require('node:assert/strict');

const Conversation = require('../models/conversation');
const Message = require('../models/message');

test('removing a conversation deletes its messages', async () => {
  const tables = { Conversations: [], Messages: [] };
  const mockClient = {
    put: ({ TableName, Item }) => ({ promise: async () => { tables[TableName].push(Item); } }),
    scan: ({ TableName }) => ({ promise: async () => ({ Items: tables[TableName] }) }),
    update: ({ TableName, Key, UpdateExpression, ExpressionAttributeValues }) => ({
      promise: async () => {
        const item = tables[TableName].find(i => i.id === Key.id);
        const attr = UpdateExpression.match(/SET (\w+)/)[1];
        item[attr] = Object.values(ExpressionAttributeValues)[0];
        return { Attributes: item };
      }
    }),
    delete: ({ TableName, Key }) => ({ promise: async () => {
      const idx = tables[TableName].findIndex(i => i.id === Key.id);
      if (idx >= 0) tables[TableName].splice(idx, 1);
    }}),
    query: ({ TableName, ExpressionAttributeValues }) => ({
      promise: async () => ({ Items: tables[TableName].filter(i => i.conversationId === ExpressionAttributeValues[':cid']) }),
    }),
    batchWrite: ({ RequestItems }) => ({ promise: async () => {
      const tableName = Object.keys(RequestItems)[0];
      RequestItems[tableName].forEach(({ DeleteRequest: { Key } }) => {
        const idx = tables[tableName].findIndex(i => i.conversationId === Key.conversationId && i.id === Key.id);
        if (idx >= 0) tables[tableName].splice(idx, 1);
      });
    }}),
  };

  Conversation.setDocClient(mockClient);
  Message.setDocClient(mockClient);

  await mockClient.put({ TableName: 'Conversations', Item: { id: '1', title: 'seed', pinned: false, createdAt: new Date().toISOString() } }).promise();
  await mockClient.put({ TableName: 'Messages', Item: { id: 'm1', conversationId: '1', content: 'hi' } }).promise();

  await Conversation.remove('1');
  const msgs = await Message.listMessages('1');
  assert.equal(msgs.length, 0);
});

