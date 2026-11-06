const { timingSafeEqual } = require('node:crypto');

function validExportKey(req) {
  const expected = process.env.FEDERATION_EXPORT_KEY;
  const supplied = req.headers['x-federation-key'];
  // This key must not accidentally become a write-capable general API key.
  if (!expected || expected === process.env.API_KEY || expected === process.env.WIX_API_KEY || typeof supplied !== 'string') return false;
  const a = Buffer.from(expected);
  const b = Buffer.from(supplied);
  return a.length === b.length && timingSafeEqual(a, b);
}

module.exports = { validExportKey };
