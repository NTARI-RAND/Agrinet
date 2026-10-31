const streams = new Map();
const accounts = new Map();
const MAX_STREAMS_PER_ACCOUNT = 5;
const MAX_TIMER_MS = 2 ** 31 - 1;

function reserve(user) {
  const expiresAt = user.exp * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return { status: 401, error: 'Expiring account token required' };
  }
  const count = accounts.get(user.userId) || 0;
  if (count >= MAX_STREAMS_PER_ACCOUNT) {
    return { status: 429, error: 'Too many open streams' };
  }
  accounts.set(user.userId, count + 1);
}

function register(id, ownerId, expiresAt, res) {
  if (!streams.has(id)) streams.set(id, new Set());
  const clients = streams.get(id);
  let timer;
  const client = { res, expiresAt, ready: false, revoked: false, cleaned: false };
  const cleanup = () => {
    if (!client.cleaned) {
      client.cleaned = true;
      const remaining = accounts.get(ownerId) - 1;
      if (remaining) accounts.set(ownerId, remaining);
      else accounts.delete(ownerId);
      clearTimeout(timer);
      clients.delete(client);
      if (!clients.size && streams.get(id) === clients) streams.delete(id);
    }
  };
  client.cleanup = cleanup;
  const expire = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) {
      cleanup();
      if (client.ready) res.end();
      else res.status(401).json({ error: 'Expiring account token required' });
    }
    else timer = setTimeout(expire, Math.min(remaining, MAX_TIMER_MS));
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
  clients.add(client);
  expire();
  return client;
}

async function open(req, res) {
  const denial = reserve(req.user);
  if (denial) return res.status(denial.status).json({ error: denial.error });
  const expiresAt = req.user.exp * 1000;
  const ownerId = req.user.userId;
  const id = req.params.conversationId;
  const client = register(id, ownerId, expiresAt, res);
  const cleanup = client.cleanup;
  // Register the pending connection BEFORE reading ownership, so a concurrent
  // committed delete can revoke it even if the database response is in flight.
  const conversation = await readOwnership(client, id, ownerId);
  if (res.destroyed || res.writableEnded) { cleanup(); return; }
  if (!conversation || client.revoked) {
    cleanup();
    return res.status(404).json({ error: 'Not found' });
  }
  if (client.cleaned) return;
  if (expiresAt <= Date.now()) {
    cleanup();
    return res.status(401).json({ error: 'Expiring account token required' });
  }
  client.ready = true;
  res.status(200).set({
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'private, no-store',
    Connection: 'keep-alive',
    'X-Accel-Buffering': 'no',
  });
  res.flushHeaders();
}

async function readOwnership(client, id, ownerId) {
  try { return await require('../models/conversation').getOwned(id, ownerId); }
  catch (error) {
    const ended = client.cleaned;
    client.cleanup();
    if (!ended) throw error;
  }
}

function send(id, event, data) {
  const clients = streams.get(id);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    if (!client.ready || client.revoked) continue;
    // Check at emission too: an overdue timer must not leak post-expiry data.
    if (client.expiresAt <= Date.now() || client.res.destroyed || client.res.writableEnded) {
      client.res.end();
      continue;
    }
    client.res.write(payload);
  }
}

function close(id) {
  const clients = streams.get(id);
  if (!clients) return;
  for (const client of clients) {
    client.revoked = true;
    client.cleanup();
    if (client.ready) client.res.end();
  }
  streams.delete(id);
}

module.exports = { open, send, close };
