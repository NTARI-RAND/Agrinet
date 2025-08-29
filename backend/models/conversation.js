const { randomUUID } = require('crypto');
let docClient = require('../lib/dynamodbClient');
const Message = require('./message');

const CONVERSATION_TABLE_NAME = process.env.CONVERSATION_TABLE_NAME || 'Conversations';

async function create(title = 'New Chat') {
  const convo = {
    id: randomUUID(),
    title,
    pinned: false,
    createdAt: new Date().toISOString(),
  };
  await docClient.put({ TableName: CONVERSATION_TABLE_NAME, Item: convo }).promise();
  return convo;
}

async function list() {
  const res = await docClient.scan({ TableName: CONVERSATION_TABLE_NAME }).promise();
  return res.Items || [];
}

async function rename(id, title) {
  try {
    const res = await docClient
      .update({
        TableName: CONVERSATION_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET title = :t',
        ExpressionAttributeValues: { ':t': title },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(id)',
      })
      .promise();
    return res.Attributes;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

async function remove(id) {
  await docClient.delete({ TableName: CONVERSATION_TABLE_NAME, Key: { id } }).promise();
  await Message.removeByConversation(id);
}

async function pin(id, pinned) {
  try {
    const res = await docClient
      .update({
        TableName: CONVERSATION_TABLE_NAME,
        Key: { id },
        UpdateExpression: 'SET pinned = :p',
        ExpressionAttributeValues: { ':p': pinned },
        ReturnValues: 'ALL_NEW',
        ConditionExpression: 'attribute_exists(id)',
      })
      .promise();
    return res.Attributes;
  } catch (err) {
    if (err.code === 'ConditionalCheckFailedException') return null;
    throw err;
  }
}

function setDocClient(client) {
  docClient = client;
}

module.exports = { create, list, rename, remove, pin, setDocClient };

