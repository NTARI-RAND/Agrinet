const { randomUUID } = require('crypto');
let docClient = require('../lib/dynamodbClient');
const Message = require('./message');

const CONVERSATION_TABLE_NAME = process.env.CONVERSATION_TABLE_NAME || 'Conversations';

async function create(title = 'New Chat', ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) throw new Error('Conversation owner required');
  const convo = {
    id: randomUUID(),
    ownerId,
    title,
    pinned: false,
    createdAt: new Date().toISOString(),
  };
  await docClient.put({ TableName: CONVERSATION_TABLE_NAME, Item: convo }).promise();
  return convo;
}

async function list(ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return [];
  const items = [];
  let cursor;
  do {
    const res = await docClient.scan({
      TableName: CONVERSATION_TABLE_NAME,
      FilterExpression: 'ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': ownerId },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }).promise();
    items.push(...(res.Items || []));
    cursor = res.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function getOwned(id, ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return null;
  const { Item } = await docClient.get({ TableName: CONVERSATION_TABLE_NAME, Key: { id }, ConsistentRead: true }).promise();
  return Item && Item.ownerId === ownerId ? Item : null;
}

async function update(id, field, value, ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return null;
  try {
    const res = await docClient
      .update({
        TableName: CONVERSATION_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET #field = :value',
        ExpressionAttributeNames: { '#field': field },
        ExpressionAttributeValues: { ':value': value, ':ownerId': ownerId },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(id) AND ownerId = :ownerId',
      })
      .promise();
    return res.Attributes;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

function rename(id, title, ownerId) { return update(id, 'title', title, ownerId); }

async function remove(id, ownerId) {
  if (typeof ownerId !== 'string' || !ownerId.trim()) return false;
  try {
    await docClient.delete({
      TableName: CONVERSATION_TABLE_NAME, Key: { id },
      ConditionExpression: 'attribute_exists(id) AND ownerId = :ownerId',
      ExpressionAttributeValues: { ':ownerId': ownerId },
    }).promise();
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') return false;
    throw err;
  }
  await Message.removeByConversation(id);
  return true;
}

function pin(id, pinned, ownerId) { return update(id, 'pinned', pinned, ownerId); }

function setDocClient(client) {
  docClient = client;
}

module.exports = { create, list, getOwned, rename, remove, pin, setDocClient };
