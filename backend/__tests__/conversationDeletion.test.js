const { test } = require('node:test');
const assert = require('node:assert/strict');
const Conversation = require('../models/conversation');
const Message = require('../models/message');

// DynamoDB is the external boundary. Enforce its page and batch limits while
// exercising the real ownership check and conversation/message deletion code.
function deletionStore({ count = 54, failBatch = false, unprocessedCounts = [] } = {}) {
  const batches = [];
  const messagesAtConversationDelete = [];
  const conversations = new Map([
    ['mine', { id: 'mine', ownerId: 'alice' }],
    ['foreign', { id: 'foreign', ownerId: 'bob' }],
  ]);
  const messages = new Map();
  for (let index = 0; index < count; index++) {
    const id = `message-${String(index).padStart(2, '0')}`;
    messages.set(id, { id, conversationId: 'mine', content: `message ${index}` });
  }
  messages.set('foreign-message', { id: 'foreign-message', conversationId: 'foreign', content: 'private' });
  const client = {
    get: ({ Key }) => ({ promise: async () => ({ Item: conversations.get(Key.id) }) }),
    query: ({ ExpressionAttributeValues, ExclusiveStartKey }) => ({ promise: async () => {
      const remaining = [...messages.values()].filter(message =>
        message.conversationId === ExpressionAttributeValues[':cid'] &&
        (!ExclusiveStartKey || message.id > ExclusiveStartKey.id));
      const Items = remaining.slice(0, 30);
      return { Items, LastEvaluatedKey: remaining.length > 30
        ? { conversationId: Items[29].conversationId, id: Items[29].id } : undefined };
    } }),
    batchWrite: ({ RequestItems }) => ({ promise: async () => {
      const writes = RequestItems.Messages;
      if (writes.length > 25) throw new Error('DynamoDB batch exceeds 25 writes');
      if (failBatch) throw new Error('Storage unavailable');
      const unprocessedCount = unprocessedCounts[batches.length] ?? 0;
      batches.push(writes.map(({ DeleteRequest: { Key } }) => Key.id));
      const unprocessed = writes.slice(0, unprocessedCount);
      for (const { DeleteRequest: { Key } } of writes.slice(unprocessedCount)) {
        messages.delete(Key.id);
      }
      return { UnprocessedItems: unprocessed.length ? { Messages: unprocessed } : {} };
    } }),
    delete: ({ Key, ExpressionAttributeValues }) => ({ promise: async () => {
      if (conversations.get(Key.id)?.ownerId !== ExpressionAttributeValues[':ownerId']) {
        throw Object.assign(new Error('Owner mismatch'), { code: 'ConditionalCheckFailedException' });
      }
      messagesAtConversationDelete.push([...messages.keys()]);
      conversations.delete(Key.id);
      return {};
    } }),
  };
  Conversation.setDocClient(client);
  Message.setDocClient(client);
  return { conversations, messages, batches, messagesAtConversationDelete };
}

test('deletes every message across DynamoDB pages and batches before removing the conversation', async () => {
  const { conversations, messages } = deletionStore();
  assert.equal(await Conversation.remove('mine', 'alice'), true);
  assert.equal(conversations.has('mine'), false);
  assert.deepEqual([...messages.values()], [
    { id: 'foreign-message', conversationId: 'foreign', content: 'private' },
  ]);
  assert.equal(conversations.get('foreign').ownerId, 'bob');
});

test('a failed message deletion leaves the owned conversation available for retry', async () => {
  const { conversations, messages } = deletionStore({ count: 1, failBatch: true });
  await assert.rejects(Conversation.remove('mine', 'alice'), /Storage unavailable/);
  assert.equal(conversations.has('mine'), true);
  assert.equal(messages.size, 2);
});

test('retries only unprocessed writes before deleting a conversation across multiple pages', async () => {
  const { conversations, batches, messagesAtConversationDelete } = deletionStore({
    count: 64,
    unprocessedCounts: [2, 1],
  });

  assert.equal(await Conversation.remove('mine', 'alice'), true);
  assert.deepEqual(batches.map(batch => batch.length), [25, 2, 1, 5, 25, 5, 4]);
  assert.deepEqual(batches.slice(1, 3), [['message-00', 'message-01'], ['message-00']]);
  assert.deepEqual(messagesAtConversationDelete, [['foreign-message']]);
  assert.equal(conversations.has('mine'), false);
});

test('persistent unprocessed writes exhaust retries and leave the conversation available', async () => {
  const { conversations, messages, batches, messagesAtConversationDelete } = deletionStore({
    count: 1,
    unprocessedCounts: [1, 1, 1, 1],
  });

  await assert.rejects(Conversation.remove('mine', 'alice'), /Message deletion incomplete/);
  assert.deepEqual(batches, [['message-00'], ['message-00'], ['message-00'], ['message-00']]);
  assert.deepEqual(messagesAtConversationDelete, []);
  assert.equal(conversations.has('mine'), true);
  assert.equal(messages.has('message-00'), true);
});

test('a foreign or missing conversation cannot trigger message deletion', async () => {
  const { conversations, messages } = deletionStore();
  assert.equal(await Conversation.remove('foreign', 'alice'), false);
  assert.equal(await Conversation.remove('missing', 'alice'), false);
  assert.equal(conversations.get('foreign').ownerId, 'bob');
  assert.equal(messages.size, 55);
});
