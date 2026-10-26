const streams = new Map();
const MAX_TIMER_MS = 2 ** 31 - 1;

async function open(req, res) {
  const expiresAt = req.user.exp * 1000;
  if (!Number.isFinite(expiresAt) || expiresAt <= Date.now()) {
    return res.status(401).json({ error: 'Expiring account token required' });
  }
  const id = req.params.conversationId;
  if (!streams.has(id)) streams.set(id, new Set());
  const clients = streams.get(id);
  let timer;
  const client = { res, expiresAt, ready: false, revoked: false };
  const cleanup = () => {
    clearTimeout(timer);
    clients.delete(client);
    if (!clients.size && streams.get(id) === clients) streams.delete(id);
  };
  const expire = () => {
    const remaining = expiresAt - Date.now();
    if (remaining <= 0) { cleanup(); res.end(); }
    else timer = setTimeout(expire, Math.min(remaining, MAX_TIMER_MS));
  };
  res.on('close', cleanup);
  res.on('error', cleanup);
  clients.add(client);
  // Register the pending connection BEFORE reading ownership, so a concurrent
  // committed delete can revoke it even if the database response is in flight.
  let conversation;
  try { conversation = await require('../models/conversation').getOwned(id, req.user.userId); }
  catch (error) { cleanup(); throw error; }
  if (!conversation || client.revoked) {
    cleanup();
    return res.status(404).json({ error: 'Not found' });
  }
  if (res.destroyed) { cleanup(); return; }
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
  expire();
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
    if (client.ready) client.res.end();
  }
  streams.delete(id);
}

module.exports = { open, send, close };
