const { createHash, randomBytes, createCipheriv, createDecipheriv } = require('node:crypto');

function badPage() {
  return Object.assign(new Error('Invalid or expired pagination parameters'), { status: 400 });
}

function encryptionKey() {
  if (!process.env.JWT_SECRET) {
    throw Object.assign(new Error('Pagination requires JWT_SECRET configuration'), { status: 503 });
  }
  return createHash('sha256').update('agrinet-collection-page-v1\0').update(process.env.JWT_SECRET).digest();
}

function encode(state, scope) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', encryptionKey(), iv);
  cipher.setAAD(Buffer.from(scope));
  const bytes = Buffer.concat([
    cipher.update(JSON.stringify({ state, expires: Date.now() + 3600000 })), cipher.final(),
  ]);
  return Buffer.concat([iv, cipher.getAuthTag(), bytes]).toString('base64url');
}

function decode(token, scope) {
  const key = encryptionKey();
  try {
    if (typeof token !== 'string' || token.length > 16384 || !/^[\w-]+$/.test(token)) throw badPage();
    const bytes = Buffer.from(token, 'base64url');
    if (bytes.length < 29 || bytes.toString('base64url') !== token) throw badPage();
    const decipher = createDecipheriv('aes-256-gcm', key, bytes.subarray(0, 12));
    decipher.setAAD(Buffer.from(scope));
    decipher.setAuthTag(bytes.subarray(12, 28));
    const decoded = JSON.parse(Buffer.concat([decipher.update(bytes.subarray(28)), decipher.final()]).toString());
    if (!Number.isFinite(decoded.expires) || decoded.expires <= Date.now() || !decoded.state || typeof decoded.state !== 'object' || Array.isArray(decoded.state)) throw badPage();
    return decoded.state;
  } catch { throw badPage(); }
}

function collectionPage(query, scope) {
  const rawLimit = query.limit === undefined ? '50' : query.limit;
  if (typeof rawLimit !== 'string' || !/^[1-9]\d*$/.test(rawLimit)) throw badPage();
  const limit = Number(rawLimit);
  if (!Number.isSafeInteger(limit) || limit > 100) throw badPage();
  const boundScope = JSON.stringify([scope, limit]);
  // Fail configuration before scanning, including first/last pages with no cursor.
  encryptionKey();
  return {
    limit,
    state: query.cursor === undefined ? undefined : decode(query.cursor, boundScope),
    finish(res, state) {
      const next = state ? encode(state, boundScope) : null;
      res.set('Cache-Control', 'private, no-store');
      res.set('X-Pagination', 'cursor-v1');
      res.set('X-Page-Limit', String(limit));
      if (next) res.set('X-Next-Cursor', next);
    },
  };
}

async function scanPage(client, params, limit, start) {
  const result = await client.scan({ ...params, Limit: limit, ...(start && { ExclusiveStartKey: start }) }).promise();
  const next = result.LastEvaluatedKey;
  return { items: result.Items || [], next: next && Object.keys(next).length ? next : null };
}

function pageError(res, error, fallback) {
  const status = error.status === 400 || error.status === 503 ? error.status : 500;
  return res.status(status).json({ error: status === 500 ? fallback : error.message });
}

async function* scanItems(client, params) {
  let start;
  do {
    const page = await scanPage(client, params, 50, start);
    yield* page.items;
    start = page.next;
  } while (start);
}

module.exports = { collectionPage, scanPage, scanItems, pageError };
