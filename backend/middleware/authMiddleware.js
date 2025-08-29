const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  const apiKey = req.headers['x-api-key'];
  if (apiKey && apiKey === process.env.WIX_API_KEY) {
    return next();
  }

  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    try {
      const token = authHeader.slice(7);
      const payload = jwt.verify(token, process.env.JWT_SECRET);
      req.user = payload;
      return next();
    } catch (err) {
      return res.status(401).json({ error: 'Unauthorized: Invalid Token' });
    }
  }

  return res.status(403).json({ error: 'Unauthorized: Invalid API Key or Token' });
};
