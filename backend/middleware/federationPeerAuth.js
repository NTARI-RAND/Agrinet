const crypto = require('node:crypto');

const MAX_CLOCK_SKEW_SECONDS = 300;

function loadPeers() {
  let peers;
  try {
    peers = JSON.parse(process.env.FEDERATION_PEERS_JSON || '{}');
  } catch {
    throw new Error('FEDERATION_PEERS_JSON must be valid JSON');
  }
  if (!peers || Array.isArray(peers) || typeof peers !== 'object') {
    throw new Error('FEDERATION_PEERS_JSON must be an object');
  }
  return peers;
}

function requestDigest(req) {
  const body = Buffer.isBuffer(req.rawBody) ? req.rawBody : Buffer.alloc(0);
  return crypto.createHash('sha256').update(body).digest('hex');
}

function signaturePayload(req, timestamp) {
  const path = (req.originalUrl || req.url).split('?')[0];
  return [timestamp, req.method.toUpperCase(), path, requestDigest(req)].join('.');
}

function safeEqualHex(actual, expected) {
  if (typeof actual !== 'string' || !/^[a-f0-9]{64}$/i.test(actual)) return false;
  const actualBuffer = Buffer.from(actual, 'hex');
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actualBuffer.length === expectedBuffer.length &&
    crypto.timingSafeEqual(actualBuffer, expectedBuffer);
}

function createPeerHeaders({ nodeId, secret, method, path, body = '' }) {
  if (!nodeId || !secret) throw new Error('Federation peer credentials are required');
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const payload = [timestamp, method.toUpperCase(), path.split('?')[0], digest].join('.');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    'x-federation-node-id': nodeId,
    'x-federation-timestamp': timestamp,
    'x-federation-signature': signature
  };
}

function requireFederationPeer(req, res, next) {
  try {
    const nodeId = req.get('x-federation-node-id');
    const timestamp = req.get('x-federation-timestamp');
    const signature = req.get('x-federation-signature');

    if (!nodeId || !/^[A-Za-z0-9._:-]{1,128}$/.test(nodeId) ||
        !timestamp || !/^\d{10}$/.test(timestamp)) {
      return res.status(401).json({ error: 'Authenticated federation peer required' });
    }

    const seconds = Math.floor(Date.now() / 1000);
    if (Math.abs(seconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) {
      return res.status(401).json({ error: 'Federation request timestamp expired' });
    }

    const peers = loadPeers();
    const secret = peers[nodeId];
    if (typeof secret !== 'string' || secret.length < 32) {
      return res.status(401).json({ error: 'Unknown federation peer' });
    }

    const expected = crypto.createHmac('sha256', secret)
      .update(signaturePayload(req, timestamp))
      .digest('hex');

    if (!safeEqualHex(signature, expected)) {
      return res.status(401).json({ error: 'Invalid federation signature' });
    }

    // Provenance is assigned only after authenticating the peer credential.
    req.federationPeer = Object.freeze({ nodeId });
    return next();
  } catch (error) {
    return res.status(503).json({ error: 'Federation authentication is not configured' });
  }
}

function createPeerResponseHeaders({ nodeId, secret, method, path, body }) {
  const timestamp = String(Math.floor(Date.now() / 1000));
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const payload = [timestamp, 'RESPONSE:' + method.toUpperCase(), path.split('?')[0], digest].join('.');
  const signature = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return {
    'x-federation-response-node-id': nodeId,
    'x-federation-response-timestamp': timestamp,
    'x-federation-response-signature': signature
  };
}

function verifyPeerResponse({ headers, expectedNodeId, secret, method, path, body }) {
  const nodeId = headers['x-federation-response-node-id'];
  const timestamp = headers['x-federation-response-timestamp'];
  const signature = headers['x-federation-response-signature'];
  const seconds = Math.floor(Date.now() / 1000);
  if (nodeId !== expectedNodeId || !timestamp || !/^\\d{10}$/.test(timestamp) ||
      Math.abs(seconds - Number(timestamp)) > MAX_CLOCK_SKEW_SECONDS) return false;
  const digest = crypto.createHash('sha256').update(body).digest('hex');
  const payload = [timestamp, 'RESPONSE:' + method.toUpperCase(), path.split('?')[0], digest].join('.');
  const expected = crypto.createHmac('sha256', secret).update(payload).digest('hex');
  return safeEqualHex(signature, expected);
}

module.exports = {
  requireFederationPeer,
  createPeerHeaders,
  createPeerResponseHeaders,
  verifyPeerResponse
};
