const messages = [];

function sendMessage(from, to, message) {
  const msg = { id: messages.length + 1, from, to, message, date: new Date().toISOString() };
  messages.push(msg);
  return msg;
}

function listMessages(userId) {
  return messages.filter(m => m.to === userId || m.from === userId);
}

module.exports = { sendMessage, listMessages };
