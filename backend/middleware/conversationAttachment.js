const path = require('node:path');
const Message = require('../models/message');

module.exports = async (req, res) => {
  const { name } = req.params;
  if (!name || name === '.' || name === '..' || /[/\\\0]/.test(name)) {
    return res.status(404).json({ error: 'Not found' });
  }
  if (!await Message.findConversationAttachment(req.params.id, '/uploads/' + name)) {
    return res.status(404).json({ error: 'Not found' });
  }
  res.sendFile(name, {
    root: path.join(__dirname, '../uploads'), dotfiles: 'deny',
    headers: {
      'Cache-Control': 'private, no-store',
      'Content-Disposition': 'attachment',
      'Content-Type': 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
    },
  });
};
