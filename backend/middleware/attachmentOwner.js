const Message = require('../models/message');
const Conversation = require('../models/conversation');

module.exports = async (req, res, next) => {
  let filename;
  try { filename = decodeURIComponent(req.path).slice(1); } catch { /* invalid URL */ }
  if (!filename || filename.includes('/') || filename.includes('\\') || filename.includes('\0') || filename === '.' || filename === '..') {
    return res.status(404).json({ error: 'Not found' });
  }
  const messages = await Message.findByAttachmentPath(`/uploads/${filename}`);
  for (const message of messages) {
    if (await Conversation.getOwned(message.conversationId, req.user.userId)) {
      // Private response must not be cached across accounts after authorization.
      res.set('Cache-Control', 'private, no-store');
      return next();
    }
  }
  return res.status(404).json({ error: 'Not found' });
};
