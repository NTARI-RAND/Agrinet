const express = require("express");
const http = require('http');
let cors;
try { cors = require('cors'); } catch { cors = () => (_req, _res, next) => next(); }
let dotenv;
try { dotenv = require('dotenv'); } catch { dotenv = { config: () => {} }; }
dotenv.config();
const authMiddleware = require('./middleware/authMiddleware');
const { apiRateLimit, chatRateLimit, streamRateLimit, locationRateLimit } = require('./middleware/rateLimit');
const minimal = process.env.MINIMAL_SERVER === 'true';
const app = express();
const allowedOrigins = (process.env.CORS_ALLOWED_ORIGINS || 'https://www.ntari.org').split(',').map(origin => origin.trim()).filter(Boolean);
app.use(cors({ origin(origin, callback) { if (!origin || allowedOrigins.includes(origin)) return callback(null, true); return callback(new Error('CORS not allowed for this origin')); }, credentials: true, methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'], allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'X-API-Key', 'X-Federation-Node-Id', 'X-Federation-Timestamp', 'X-Federation-Signature'] }));
app.use(express.json({ verify(req, _res, buffer) { req.rawBody = Buffer.from(buffer); } }));
const tryMount = (route, modPath) => { try { app.use(route, require(modPath)); } catch (err) { console.warn('Skipping ' + modPath + ': ' + err.message); } };
if (!minimal) tryMount('/deposit', './routes/depositRoutes');
app.get('/health', (_req, res) => res.status(200).send('OK'));
const server = http.createServer(app);
// Fail closed until owner-authenticated streaming (#192) is merged.
app.get('/events', (_req, res) => res.status(410).json({ error: 'Global event stream retired; use authenticated conversation streams' }));
app.get('/stream/:conversationId', streamRateLimit, (_req, res) => res.status(410).json({ error: 'Conversation streaming is temporarily unavailable pending owner-authenticated stream support' }));
const conversationStreams = new Map();
function sendConversationEvent(conversationId, event, data) { const clients = conversationStreams.get(conversationId); if (!clients) return; const payload = 'event: ' + event + '\\ndata: ' + JSON.stringify(data) + '\\n\\n'; clients.forEach(res => res.write(payload)); }
function broadcast(event, data, conversationId) { if (conversationId) sendConversationEvent(conversationId, event, data); }
global.broadcast = broadcast;
global.emitToken = (conversationId, id, token) => sendConversationEvent(conversationId, 'token', { id, token });
global.emitMessage = (conversationId, message) => sendConversationEvent(conversationId, 'message', { message });
if (!minimal) tryMount('/federation', './federation/federationRoutes');

app.use(authMiddleware);
app.use(apiRateLimit);
// Private uploads are disabled until conversation-owner authorization is deployed (#191).\napp.use('/uploads', (_req, res) => res.status(410).json({ error: 'Attachment downloads are temporarily unavailable pending owner authorization' }));
app.use('/api/location', locationRateLimit);
let runFederationSync;
if (!minimal) {
  [['/', './routes/api'], ['/api/auth', './routes/authRoutes'], ['/api/keys', './routes/keyRoutes'], ['/api/contracts', './routes/contracts'], ['/api/admin', './routes/admin'], ['/api/marketplace', './marketplace/marketplace_routes'], ['/users', './routes/userRoutes'], ['/products', './routes/products'], ['/broadcast', './routes/broadcastRoutes'], ['/sms', './routes/smsRoutes'], ['/cart', './routes/cartRoutes'], ['/orders', './routes/orderRoutes'], ['/subscriptions', './routes/subscriptionRoutes'], ['/conversations', './routes/conversationRoutes'], ['/messages', './routes/communicationRoutes'], ['/inventory', './routes/inventoryRoutes'], ['/api/location', './routes/locationRoutes'], ['/federation', './federation/federationRoutes'], ['/trends', './trends/trendsRoutes']].forEach(([route, mod]) => tryMount(route, mod));
  try { runFederationSync = require('./federation/federationSyncJob'); } catch (err) { console.warn('Federation sync disabled: ' + err.message); }
}
const PORT = process.env.PORT || 5000;
if (require.main === module) { server.listen(PORT, () => console.log('Server running on port ' + PORT)); if (runFederationSync) runFederationSync(); }
module.exports = { app, server };
