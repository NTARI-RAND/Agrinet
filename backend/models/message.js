const fs = require('fs');
const path = require('path');

const DATA_FILE = path.join(__dirname, '../data/messages.json');
const UPLOAD_DIR = path.join(__dirname, '../uploads');
if (!fs.existsSync(UPLOAD_DIR)) fs.mkdirSync(UPLOAD_DIR, { recursive: true });
let messages = [];
try {
  messages = JSON.parse(fs.readFileSync(DATA_FILE));
} catch (e) {
  messages = [];
}

function save() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(messages, null, 2));
}

function sendMessage(conversationId, from, to, content, type = 'text', file) {
  const msg = {
    id: messages.length + 1,
    conversationId,
    from,
    to,
    sender: from,
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
  messages.push(msg);
  save();
  return msg;
}

function listMessages(conversationId) {
  return messages.filter((m) => m.conversationId === conversationId);
}

function removeByConversation(conversationId) {
  messages = messages.filter((m) => m.conversationId !== conversationId);
  save();
}

module.exports = { sendMessage, listMessages, removeByConversation };
