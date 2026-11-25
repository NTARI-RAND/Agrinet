const Conversation = require('../models/conversation');

module.exports = async (req, res, next) => {
  const conversation = await Conversation.getOwned(req.params.conversationId || req.params.id, req.user.userId);
  if (!conversation) return res.status(404).json({ error: 'Not found' });
  req.conversation = conversation;
  return next();
};
