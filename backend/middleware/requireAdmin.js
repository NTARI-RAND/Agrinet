// Admin authorization must be based on a verified account token, never the shared API key.
module.exports = function requireAdmin(req, res, next) {
  const user = req.user;
  if (!user || typeof user.userId !== 'string' || !user.userId || user.role !== 'admin') {
    return res.status(403).json({ error: 'Admin access required' });
  }
  return next();
};
