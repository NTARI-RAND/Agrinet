const Message = require('../models/message');

exports.sendMessage = (req, res) => {
  const { from, to, message } = req.body;
  const msg = Message.sendMessage(from, to, message);
  res.status(201).json(msg);
};

exports.listMessages = (req, res) => {
  const { userId } = req.params;
  const msgs = Message.listMessages(userId);
  res.json(msgs);
};
