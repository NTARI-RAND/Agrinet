const Message = require('../models/message');

exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { from, to, content, type, file } = req.body;
  
  // Create and persist the message
  const msg = await Message.sendMessage(conversationId, { from, to, content, type, file });

  // Stream tokenized parts over SSE if a broadcast function is available
  if (global.broadcast) {
    const tokens = (msg.content || '').split(/\s+/);
    tokens.forEach((token) => {
      global.broadcast('message', { type: 'token', id: msg.id, token }, conversationId);
    });

    // Send the final message object after streaming tokens
    global.broadcast('message', { type: 'message', message: msg }, conversationId);
  }

  // Fallback / additional emitter used elsewhere in the codebase
  if (global.emitMessage) {
    global.emitMessage(conversationId, msg);
  }

  res.status(201).json(msg);
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};
