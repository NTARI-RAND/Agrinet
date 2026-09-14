const rateLimit = require('express-rate-limit');

const WINDOW_MS = 15 * 60 * 1000; // 15 minutes

const common = {
  windowMs: WINDOW_MS,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Too many requests, please try again later.' },
};

// Broad ceiling for every request the API serves.
const apiLimiter = rateLimit({ ...common, limit: 600 });

// Tighter ceiling for routers that write to storage or fan out to other services.
const writeLimiter = rateLimit({ ...common, limit: 60 });

// Tightest ceiling for upload routes, the most expensive per request.
const uploadLimiter = rateLimit({ ...common, limit: 20 });

module.exports = { apiLimiter, writeLimiter, uploadLimiter };
