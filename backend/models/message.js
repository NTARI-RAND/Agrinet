const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

let docClient = require('../lib/dynamodbClient');

const MESSAGE_TABLE_NAME = process.env.MESSAGE_TABLE_NAME || 'Messages';
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });

async function sendMessage(conversationId, { id = randomUUID(), from, to, content, type = 'text', file }) {
  const msg = {
    id,
    conversationId,
    from,
    to,
    content,
    type,
    timestamp: new Date().toISOString(),
  };

  if (file && file.data) {
    const filename = Date.now() + '_' + file.name;
    const filePath = path.join(UPLOAD_DIR, filename);
    fs.writeFileSync(filePath, Buffer.from(file.data, 'base64'));
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

async function removeByConversation(conversationId) {
  const messages = await listMessages(conversationId);
  if (!messages.length) return;
  const deletes = messages.map((m) => ({
    DeleteRequest: { Key: { conversationId: m.conversationId, id: m.id } },
  }));
  await docClient
    .batchWrite({ RequestItems: { [MESSAGE_TABLE_NAME]: deletes } })
    .promise();
}

function setDocClient(client) {
  docClient = client;
}

module.exports = { sendMessage, listMessages, removeByConversation, setDocClient };

