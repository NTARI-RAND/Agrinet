const { createHash, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');

// Separate storage keeps local coordinates out of raw Users exports/imports.
const LOCATION_TABLE_NAME = process.env.LOCATION_TABLE_NAME || 'Locations';
function publicLocation(item) {
  return { id: item.id, coordinates: { lat: item.coordinates.lat, long: item.coordinates.long },
    ...(item.locationType === undefined ? {} : { locationType: item.locationType }) };
}
function key() {
  if (!process.env.JWT_SECRET) throw new Error('JWT_SECRET is required');
  return createHash('sha256').update('agrinet-location-cursor-v1\0').update(process.env.JWT_SECRET).digest();
}
// Encrypt the scan key: it may belong to a private location, even on an empty page.
function encodeCursor(start, scope) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  cipher.setAAD(Buffer.from(scope));
  const data = Buffer.concat([cipher.update(JSON.stringify({ start, expires: Date.now() + 3600000 })), cipher.final()]);
  return Buffer.concat([iv, cipher.getAuthTag(), data]).toString('base64url');
}
function decodeCursor(token, scope) {
  if (typeof token !== 'string' || token.length > 2048 || !/^[\w-]+$/.test(token)) throw new Error('Invalid cursor');
  const bytes = Buffer.from(token, 'base64url');
  const cipher = createDecipheriv('aes-256-gcm', key(), bytes.subarray(0, 12));
  cipher.setAAD(Buffer.from(scope));
  cipher.setAuthTag(bytes.subarray(12, 28));
  const result = JSON.parse(Buffer.concat([cipher.update(bytes.subarray(28)), cipher.final()]).toString());
  if (!Number.isFinite(result.expires) || result.expires < Date.now() || typeof result.start?.id !== 'string') throw new Error('Expired cursor');
  return { id: result.start.id };
}
module.exports = { LOCATION_TABLE_NAME, publicLocation, encodeCursor, decodeCursor };
