const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');
const { setTimeout: delay } = require('node:timers/promises');

let docClient = require('../lib/dynamodbClient');

const MESSAGE_TABLE_NAME = process.env.MESSAGE_TABLE_NAME || 'Messages';
const MAX_BATCH_DELETE_RETRIES = 3;
const INITIAL_BATCH_DELETE_BACKOFF_MS = 25;
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function sendMessage(
  conversationId,
  { id, from, to, content, type = 'text', file, timestamp }
) {
  const ts = timestamp ? new Date(timestamp) : new Date();
  const safeTimestamp = Number.isNaN(ts.getTime()) ? new Date() : ts;

  const msg = {
    id: id || randomUUID(),
    conversationId,
    from,
    to,
    content,
    type,
    timestamp: safeTimestamp.toISOString(),
  };

  if (file && file.data) {
    const extension = path.extname(file.name || '');
    const filename = randomUUID() + (/^\.[a-zA-Z0-9]{1,10}$/.test(extension) ? extension : '');
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(file.data, 'base64'), { flag: 'wx' });
    msg.file = {
      path: '/uploads/' + filename,
      originalname: file.name,
      mimetype: file.type,
    };
  }

  await docClient.put({ TableName: MESSAGE_TABLE_NAME, Item: msg }).promise();
  return msg;
}

async function listMessages(conversationId) {
  const res = await docClient
    .query({
      TableName: MESSAGE_TABLE_NAME,
      KeyConditionExpression: 'conversationId = :cid',
      ExpressionAttributeValues: { ':cid': conversationId },
    })
    .promise();
  return res.Items || [];
}

async function getMessage(conversationId, id) {
  const { Item } = await docClient.get({
    TableName: MESSAGE_TABLE_NAME, Key: { conversationId, id }, ConsistentRead: true,
  }).promise();
  return Item || null;
}

async function deleteMessageBatch(deletes) {
  let pending = deletes;
  for (let attempt = 0; attempt <= MAX_BATCH_DELETE_RETRIES; attempt++) {
    if (attempt > 0) {
      await delay(INITIAL_BATCH_DELETE_BACKOFF_MS * 2 ** (attempt - 1));
    }
    const result = await docClient.batchWrite({
      RequestItems: { [MESSAGE_TABLE_NAME]: pending },
    }).promise();
    pending = result?.UnprocessedItems?.[MESSAGE_TABLE_NAME];
    if (!pending?.length) return;
  }
  throw new Error('Message deletion incomplete; retry conversation deletion');
}

async function removeByConversation(conversationId) {
  let cursor;
  do {
    const page = await docClient.query({
      TableName: MESSAGE_TABLE_NAME,
      KeyConditionExpression: 'conversationId = :cid',
      ExpressionAttributeValues: { ':cid': conversationId },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }).promise();
    const messages = page.Items || [];
    for (let start = 0; start < messages.length; start += 25) {
      const deletes = messages.slice(start, start + 25).map(message => ({
        DeleteRequest: { Key: { conversationId, id: message.id } },
      }));
      await deleteMessageBatch(deletes);
    }
    cursor = page.LastEvaluatedKey;
  } while (cursor);
}

function setDocClient(client) {
  docClient = client;
}

async function findByAttachmentPath(filePath) {
  const items = [];
  let cursor;
  do {
    const page = await docClient.scan({
      TableName: MESSAGE_TABLE_NAME,
      FilterExpression: '#file.#path = :filePath',
      ExpressionAttributeNames: { '#file': 'file', '#path': 'path' },
      ExpressionAttributeValues: { ':filePath': filePath },
      ...(cursor && { ExclusiveStartKey: cursor }),
    }).promise();
    items.push(...(page.Items || []));
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return items;
}

async function findConversationAttachment(conversationId, filePath) {
  let cursor;
  do {
    const page = await docClient.query({
      TableName: MESSAGE_TABLE_NAME,
      KeyConditionExpression: 'conversationId = :cid',
      FilterExpression: '#file.#path = :filePath',
      ExpressionAttributeNames: { '#file': 'file', '#path': 'path' },
      ExpressionAttributeValues: { ':cid': conversationId, ':filePath': filePath },
      Limit: 100,
      ...(cursor && { ExclusiveStartKey: cursor }),
    }).promise();
    if (page.Items?.some(message => message.file?.path === filePath)) return true;
    cursor = page.LastEvaluatedKey;
  } while (cursor);
  return false;
}

module.exports = { sendMessage, listMessages, getMessage, removeByConversation, findByAttachmentPath, findConversationAttachment, setDocClient };
