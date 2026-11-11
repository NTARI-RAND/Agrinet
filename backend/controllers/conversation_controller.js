const Conversation = require('../models/conversation');
const { collectionPage, pageError } = require('../lib/collectionPage');

exports.create = async (req, res) => {
  const { title } = req.body;
  const convo = await Conversation.create(title, req.user.userId);
  res.status(201).json(convo);
};

exports.list = async (req, res) => {
  try {
    const page = collectionPage(req.query, ['conversations', req.user.userId]);
    const { items, next } = await Conversation.listPage(req.user.userId, page.limit, page.state?.start);
    page.finish(res, next && { start: next });
    res.json(items);
  } catch (error) { pageError(res, error, 'Failed to fetch conversations'); }
};

exports.get = (req, res) => res.json(req.conversation);

exports.rename = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const convo = await Conversation.rename(id, title, req.user.userId);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json(convo);
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const removed = await Conversation.remove(id, req.user.userId);
  if (!removed) return res.status(404).json({ error: 'Not found' });
  res.status(204).end();
};

exports.pin = async (req, res) => {
  const { id } = req.params;
  const { pinned } = req.body;
  const convo = await Conversation.pin(id, pinned, req.user.userId);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json(convo);
};
