const Message = require('../models/message');

exports.sendMessage = async (req, res) => {
  const { conversationId } = req.params;
  const { from, to, content, type, file } = req.body;
  const msg = await Message.sendMessage(conversationId, from, to, content, type, file);
  if (global.broadcast) {
    global.broadcast('message', msg);
  }
  res.status(201).json(msg);
};

exports.listMessages = async (req, res) => {
  const { conversationId } = req.params;
  const msgs = await Message.listMessages(conversationId);
  res.json(msgs);
};
