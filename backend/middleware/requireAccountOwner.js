module.exports = (req, res, next) => {
  const userId = req.user?.userId;
  if (typeof userId !== 'string' || !userId || userId !== req.params.userId) {
    return res.status(403).json({ error: 'Forbidden: Account ownership required' });
  }
  next();
};
