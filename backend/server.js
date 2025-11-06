// server.js — Minimal Registry Node (in-memory)
const express = require('express');
const http = require('http');
const cors = require('cors');

const PORT = Number(process.env.PORT || 3000);
const NODE_ENV = process.env.NODE_ENV || 'production';
const NODE_ID = process.env.NODE_ID || 'registry-node';
const NODE_TYPE = process.env.NODE_TYPE || 'registry';
const REGISTRY_URI = process.env.REGISTRY_URI || '';
const REGISTRY_API_KEY = process.env.REGISTRY_API_KEY || '';
const MINIMAL_SERVER = String(process.env.MINIMAL_SERVER || 'true') === 'true';

// --- CORS: allow your domains only (adjust as needed)
const allowedOrigins = ['https://www.ntari.org', 'https://registry.ntari.org', 'https://api.ntari.org'];
const app = express();
app.use(cors({
  origin(origin, cb) {
    if (!origin || allowedOrigins.includes(origin)) return cb(null, true);
    cb(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization']
}));
app.use(express.json());

// --- health (no auth)
app.get('/health', (_req, res) => {
  res.status(200).json({
    ok: true,
    uptime: process.uptime(),
    pid: process.pid,
    ts: Date.now(),
    env: NODE_ENV,
    nodeId: NODE_ID,
    nodeType: NODE_TYPE,
    mode: MINIMAL_SERVER ? 'memory' : 'unknown'
  });
});

// --- simple API key auth for registry mutations
function requireRegistryKey(req, res, next) {
  if (!REGISTRY_API_KEY) return next(); // no key configured -> open (not recommended)
  const hdr = req.headers['x-registry-key'] || req.headers['authorization'] || '';
  const token = hdr.startsWith('Bearer ') ? hdr.slice(7) : hdr;
  if (token === REGISTRY_API_KEY) return next();
  return res.status(401).json({ error: 'invalid registry key' });
}

// --- In-memory peers store
// shape: { [peerId]: { peerId, host, updatedAt, meta? } }
const peers = Object.create(null);

// Register or refresh a peer
app.post('/federation/register', requireRegistryKey, (req, res) => {
  const { peerId, host, meta } = req.body || {};
  if (!peerId || !host) {
    return res.status(400).json({ error: 'peerId and host are required' });
  }
  peers[peerId] = {
    peerId,
    host,
    meta: meta || {},
    updatedAt: Date.now()
  };
  return res.status(200).json({
    ok: true,
    registry: REGISTRY_URI,
    peer: peers[peerId],
    count: Object.keys(peers).length
  });
});

// List peers (optional filter by updated window)
app.get('/federation/peers', (_req, res) => {
  const list = Object.values(peers).sort((a,b) => b.updatedAt - a.updatedAt);
  return res.status(200).json({
    ok: true,
    registry: REGISTRY_URI,
    count: list.length,
    peers: list
  });
});

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Uncaught Error:', err?.stack || err);
  res.status(500).json({ error: 'Internal Server Error' });
});

// Start HTTP server
const server = http.createServer(app);
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Starting in MINIMAL registry mode (in-memory)`);
  if (REGISTRY_URI) console.log(`Registry listening at ${REGISTRY_URI}`);
});

// Optional: graceful shutdown logging
process.on('SIGINT', () => {
  console.log('Received SIGINT, shutting down...');
  server.close(() => process.exit(0));
});
