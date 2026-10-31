// Explicit integration check: creates and removes isolated DynamoDB Local tables.
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { DynamoDBClient, CreateTableCommand, DeleteTableCommand } = require('@aws-sdk/client-dynamodb');

async function main() {
  const endpoint = process.env.DYNAMODB_ENDPOINT;
  const parsed = new URL(endpoint);
  if (!['127.0.0.1', 'localhost', '[::1]'].includes(parsed.hostname)) throw new Error('DynamoDB Local loopback endpoint required');
  process.env.AWS_ACCESS_KEY_ID = 'localcheck';
  process.env.AWS_SECRET_ACCESS_KEY = 'localcheck';
  process.env.AWS_REGION = 'us-east-1';
  const suffix = randomUUID().replaceAll('-', '');
  process.env.CONVERSATION_TABLE_NAME = `ChatOwnership_${suffix}`;
  process.env.MESSAGE_TABLE_NAME = `ChatMessages_${suffix}`;
  const admin = new DynamoDBClient({ endpoint, region: 'us-east-1', credentials: { accessKeyId: 'localcheck', secretAccessKey: 'localcheck' } });
  const tables = [];
  try {
    for (const [TableName, keys] of [
      [process.env.CONVERSATION_TABLE_NAME, [{ AttributeName: 'id', KeyType: 'HASH' }]],
      [process.env.MESSAGE_TABLE_NAME, [{ AttributeName: 'conversationId', KeyType: 'HASH' }, { AttributeName: 'id', KeyType: 'RANGE' }]],
    ]) {
      await admin.send(new CreateTableCommand({
        TableName, KeySchema: keys, AttributeDefinitions: keys.map(({ AttributeName }) => ({ AttributeName, AttributeType: 'S' })), BillingMode: 'PAY_PER_REQUEST',
      }));
      tables.push(TableName);
    }
    const Conversation = require('../models/conversation');
    const Message = require('../models/message');
    const db = require('../lib/dynamodbClient');
    const mine = await Conversation.create('private', 'alice');
    await Conversation.create('foreign', 'bob');
    await db.put({ TableName: process.env.CONVERSATION_TABLE_NAME, Item: { id: 'legacy', title: 'unknown owner' } }).promise();
    assert.equal(await Conversation.getOwned(mine.id, 'bob'), null);
    assert.equal(await Conversation.getOwned('legacy', 'alice'), null);
    assert.equal(await Conversation.rename(mine.id, 'stolen', 'bob'), null);
    assert.equal(await Conversation.pin(mine.id, true, 'bob'), null);
    assert.equal(await Conversation.remove(mine.id, 'bob'), false);
    assert.equal((await Conversation.rename(mine.id, 'renamed', 'alice')).title, 'renamed');
    assert.equal((await Conversation.pin(mine.id, true, 'alice')).pinned, true);
    for (let i = 0; i < 6; i++) await Conversation.create('x'.repeat(230000), i % 2 ? 'alice' : 'bob');
    assert.equal((await Conversation.list('alice')).length, 4);
    const message = await Message.sendMessage(mine.id, { from: 'alice', content: 'private content' });
    assert.equal((await Message.listMessages(mine.id))[0].id, message.id);
    await db.put({ TableName: process.env.MESSAGE_TABLE_NAME, Item: { id: 'attachment', conversationId: mine.id, file: { path: '/uploads/example.txt' } } }).promise();
    assert.equal((await Message.findByAttachmentPath('/uploads/example.txt'))[0].id, 'attachment');
    assert.equal(await Message.findConversationAttachment(mine.id, '/uploads/example.txt'), true);
    assert.equal(await Message.findConversationAttachment('foreign', '/uploads/example.txt'), false);
    assert.equal(await Conversation.remove(mine.id, 'alice'), true);
    assert.deepEqual(await Message.listMessages(mine.id), []);
    assert.equal(await Conversation.getOwned(mine.id, 'alice'), null);
    console.log('PASS: real DynamoDB owner conditions, legacy isolation, multi-page owner listing, message lookup and deletion');
  } finally {
    for (const TableName of tables) await admin.send(new DeleteTableCommand({ TableName }));
    admin.destroy();
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
