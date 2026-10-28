const jwt = require('jsonwebtoken');

// A shared integration key authenticates no individual participant. Verify the
// bearer independently even when the general API middleware accepted that key.
module.exports = (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Account bearer token required' });
  }
  try {
    const payload = jwt.verify(header.slice(7), process.env.JWT_SECRET, { algorithms: ['HS256'] });
    if (typeof payload.userId !== 'string' || !payload.userId.trim()) throw new Error('Missing account');
    req.user = payload;
    res.set('Cache-Control', 'private, no-store');
    return next();
  } catch {
    return res.status(401).json({ error: 'Unauthorized: Invalid Token' });
  }
};
