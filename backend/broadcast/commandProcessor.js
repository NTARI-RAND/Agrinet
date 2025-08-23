const broadcastService = require('./broadcastService');

function processCommand(payload) {
  const { command, message } = payload;
  if (command !== 'mbr') {
    throw new Error('Unsupported command');
  }
  if (!message || !message.content) {
    throw new Error('Invalid message payload');
  }
  return broadcastService.broadcast(message);
}

module.exports = { processCommand };
