const { randomUUID } = require('crypto');
const fs = require('fs');
const path = require('path');

let docClient = require('../lib/dynamodbClient');

const MESSAGE_TABLE_NAME = process.env.MESSAGE_TABLE_NAME || 'Messages';
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
    // file.name arrives from the client, so collapse it to a bare filename and
    // drop anything outside [A-Za-z0-9._-]. That strips directory separators,
    // '..' segments and NUL bytes, so the write cannot escape UPLOAD_DIR.
    const baseName = path.basename(String(file.name ?? ''));
    const safeName = baseName.replace(/[^\w.-]/g, '_').replace(/^\.+/, '') || 'upload';
    const filename = Date.now() + '_' + safeName;
    const filePath = path.join(UPLOAD_DIR, filename);
    // Defence in depth: refuse to write if the resolved path is not directly
    // inside UPLOAD_DIR.
    if (path.dirname(path.resolve(filePath)) !== path.resolve(UPLOAD_DIR)) {
      throw new Error('Refusing to write upload outside of the upload directory');
    }
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