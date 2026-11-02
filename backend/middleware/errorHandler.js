const { STATUS_CODES } = require('http');

// Last-resort error handler: always JSON, never a stack trace or file path,
// whatever NODE_ENV is. Register it after every route.
module.exports = (err, req, res, next) => {
  if (res.headersSent) return next(err);
  const status = Number.isInteger(err.status) && err.status >= 400 && err.status < 600 ? err.status : 500;
  if (status >= 500) console.error(err);
  res.status(status).json({ error: status < 500 && err.expose ? err.message : STATUS_CODES[status] });
};
