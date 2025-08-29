const Conversation = require('../models/conversation');

exports.create = async (req, res) => {
  const { title } = req.body;
  const convo = await Conversation.create(title);
  res.status(201).json(convo);
};

exports.list = async (_req, res) => {
  const convos = await Conversation.list();
  res.json(convos);
};

exports.rename = async (req, res) => {
  const { id } = req.params;
  const { title } = req.body;
  const convo = await Conversation.rename(id, title);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json(convo);
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  await Conversation.remove(id);
  res.status(204).end();
};

exports.pin = async (req, res) => {
  const { id } = req.params;
  const { pinned } = req.body;
  const convo = await Conversation.pin(id, pinned);
  if (!convo) return res.status(404).json({ error: 'Not found' });
  res.json(convo);
};
