const express = require("express");
const http = require('http');
const { rateLimit } = require('express-rate-limit');
const path = require('path');
const chatAuth = require('./middleware/chatAuth');
const asyncHandler = require('./utils/asyncHandler');
let cors;
try { cors = require('cors'); } catch { cors = () => (_req, _res, next) => next(); }
let dotenv;
try { dotenv = require('dotenv'); } catch { dotenv = { config: () => {} }; }
dotenv.config();
const authMiddleware = require('./middleware/authMiddleware');
const { apiRateLimit, locationRateLimit } = require('./middleware/rateLimit');
const { createConcurrentStreamLimit } = require('./middleware/streamConcurrency');
const minimal = process.env.MINIMAL_SERVER === 'true';
const app = express();
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://www.ntari.org').split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('CORS not allowed for this origin')); }, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-API-Key', 'X-Federation-Node-Id', 'X-Federation-Timestamp', 'X-Federation-Signature'] }));
app.use(express.json({ verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); } }));
const tryMount = (route, modPath) => { try { app.use(route, require(modPath)); } catch (err) { console.warn('Skipping ' + modPath + ': ' + err.message); } };
if (!minimal) tryMount('/deposit', './routes/depositRoutes');
app.get('/health', (_req, res) => res.status(200).send('OK'));
const server = http.createServer(app);
// Account-scoped streams share the same owner check as message reads/sends.
const conversationStreams = require('./lib/conversationStreams');
app.get('/events', (_req, res) => {
  res.status(410).json({ error: 'Global event feed retired; use an owned conversation stream' });
});
app.get('/stream/:conversationId',
  rateLimit(require('./middleware/chatRateLimit').options(300, 'stream-attempt')), chatAuth,
  rateLimit(require('./middleware/chatRateLimit').options(60, 'stream')),
  createConcurrentStreamLimit({ maximum: 5 }), asyncHandler(conversationStreams.open));

function broadcast(event, data, conversationId) {
  if (conversationId) conversationStreams.send(conversationId, event, data);
  // Generic transaction broadcasts have no recipient authorization contract.
  // Keep producers callable, but never expose them through a global feed.
}
global.broadcast = broadcast;
global.emitToken = (conversationId, id, token) => conversationStreams.send(conversationId, 'token', { id, token });
global.emitMessage = (conversationId, message) => conversationStreams.send(conversationId, 'message', { message });

// Federation authenticates with per-peer HMAC credentials, independently of browser API keys.
if (!minimal) tryMount('/federation', './federation/federationRoutes');
// Public account creation/login have their own IP throttles and do not require the browser integration key.
if (!minimal) tryMount('/api/auth', './routes/authRoutes');
app.use(authMiddleware);
app.use(apiRateLimit);
// Private uploads retain the merged conversation-owner authorization boundary.
app.use('/uploads', chatAuth, rateLimit(require('./middleware/chatRateLimit').options(60, 'uploads')), asyncHandler(require('./middleware/attachmentOwner')), express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny', index: false,
  setHeaders(res) {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));
app.use('/api/location', locationRateLimit);
let runFederationSync;
if (!minimal) {
  [['/', './routes/api'], ['/api/keys', './routes/keyRoutes'], ['/api/contracts', './routes/contracts'], ['/api/admin', './routes/admin'], ['/api/marketplace', './marketplace/marketplace_routes'], ['/users', './routes/userRoutes'], ['/products', './routes/products'], ['/broadcast', './routes/broadcastRoutes'], ['/sms', './routes/smsRoutes'], ['/cart', './routes/cartRoutes'], ['/orders', './routes/orderRoutes'], ['/subscriptions', './routes/subscriptionRoutes'], ['/conversations', './routes/conversationRoutes'], ['/messages', './routes/communicationRoutes'], ['/inventory', './routes/inventoryRoutes'], ['/api/location', './routes/locationRoutes'], ['/trends', './trends/trendsRoutes']].forEach(([route, mod]) => tryMount(route, mod));
  try { runFederationSync = require('./federation/federationSyncJob'); } catch (err) { console.warn('Federation sync disabled: ' + err.message); }
}
const PORT = process.env.PORT || 5000;
if (require.main === module) { server.listen(PORT, () => console.log('Server running on port ' + PORT)); if (runFederationSync) runFederationSync(); }
module.exports = { app, server };
