const express = require("express");
const http = require('http');
let cors;
try {
  cors = require("cors");
} catch {
  cors = () => (_req, _res, next) => next();
}
let dotenv;
try {
  dotenv = require("dotenv");
} catch {
  dotenv = { config: () => {} };
}
const path = require("path");
const authMiddleware = require("./middleware/authMiddleware");
const chatAuth = require('./middleware/chatAuth');
const asyncHandler = require('./utils/asyncHandler');

// Load environment variables
dotenv.config();

const minimal = process.env.MINIMAL_SERVER === 'true';

const app = express();

// --- PRODUCTION-READY CORS RESTRICTION ---
const allowedOrigins = ['https://www.ntari.org'];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) {
      callback(null, true);
    } else {
      callback(new Error('CORS not allowed for this origin'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Idempotency-Key', 'x-api-key']
}));
// -----------------------------------------

app.use(express.json());
const tryMount = (route, modPath) => {
  try {
    const mod = require(modPath);
    app.use(route, mod);
  } catch (err) {
    console.warn(`Skipping ${modPath}: ${err.message}`);
  }
};

if (!minimal) {
  tryMount("/deposit", "./routes/depositRoutes");
}

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Server & SSE event stream
const server = http.createServer(app);

// Account-scoped streams share the same owner check as message reads/sends.
const conversationStreams = require('./lib/conversationStreams');
app.get('/events', (_req, res) => {
  res.status(410).json({ error: 'Global event feed retired; use an owned conversation stream' });
});
app.get('/stream/:conversationId', chatAuth, require('./middleware/chatRateLimit')(60), asyncHandler(conversationStreams.open));

function broadcast(event, data, conversationId) {
  if (conversationId) conversationStreams.send(conversationId, event, data);
  // Generic transaction broadcasts have no recipient authorization contract.
  // Keep producers callable, but never expose them through a global feed.
}
global.broadcast = broadcast;
global.emitToken = (conversationId, id, token) => conversationStreams.send(conversationId, 'token', { id, token });
global.emitMessage = (conversationId, message) => conversationStreams.send(conversationId, 'message', { message });

// Middleware
app.use(authMiddleware);
app.use('/uploads', chatAuth, require('./middleware/chatRateLimit')(60), asyncHandler(require('./middleware/attachmentOwner')), express.static(path.join(__dirname, 'uploads'), {
  dotfiles: 'deny', index: false,
  setHeaders(res) {
    res.setHeader('Content-Disposition', 'attachment');
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
  },
}));

// Routes
let runFederationSync;
if (!minimal) {
  [
    ['/', './routes/api'],
    ['/api/auth', './routes/authRoutes'],
    ['/api/keys', './routes/keyRoutes'],
    ['/api/contracts', './routes/contracts'],
    ['/api/admin', './routes/admin'],
    ['/api/marketplace', './marketplace/marketplace_routes'],
    ['/users', './routes/userRoutes'],
    ['/products', './routes/products'],
    ['/broadcast', './routes/broadcastRoutes'],
    ['/sms', './routes/smsRoutes'],
    ['/cart', './routes/cartRoutes'],
    ['/orders', './routes/orderRoutes'],
    ['/subscriptions', './routes/subscriptionRoutes'],
    ['/conversations', './routes/conversationRoutes'],
    ['/messages', './routes/communicationRoutes'],
    ['/inventory', './routes/inventoryRoutes'],
    ['/api/location', './routes/locationRoutes'],
    ['/federation', './federation/federationRoutes'],
    ['/trends', './trends/trendsRoutes'],
  ].forEach(([route, mod]) => tryMount(route, mod));

  try {
    runFederationSync = require('./federation/federationSyncJob');
  } catch (err) {
    console.warn(`Federation sync disabled: ${err.message}`);
  }
}

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  if (runFederationSync) runFederationSync(); // kicks off first run when available
}

module.exports = { app, server };
