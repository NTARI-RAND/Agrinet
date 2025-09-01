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
  allowedHeaders: ['Content-Type', 'Authorization']
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

// Simple Server-Sent Events implementation
const sseClients = new Set();
// Map of conversationId -> Set of response objects
const conversationStreams = new Map();

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

// Unified conversation-scoped Server-Sent Events endpoint
app.get('/stream/:conversationId', (req, res) => {
  const { conversationId } = req.params;
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });

  if (!conversationStreams.has(conversationId)) {
    conversationStreams.set(conversationId, new Set());
  }

  const clients = conversationStreams.get(conversationId);
  clients.add(res);

  req.on('close', () => {
    clients.delete(res);
    if (clients.size === 0) {
      conversationStreams.delete(conversationId);
    }
  });
});

function sendConversationEvent(conversationId, event, data) {
  const clients = conversationStreams.get(conversationId);
  if (!clients) return;
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  clients.forEach(res => res.write(payload));
}

function broadcast(event, data, conversationId) {
  if (conversationId) {
    sendConversationEvent(conversationId, event, data);
    return;
  }
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  sseClients.forEach(res => res.write(payload));
}
global.broadcast = broadcast;

// Helpers to emit token and message events
function emitToken(conversationId, id, token) {
  sendConversationEvent(conversationId, 'token', { id, token });
}

function emitMessage(conversationId, message) {
  sendConversationEvent(conversationId, 'message', { message });
}

global.emitToken = emitToken;
global.emitMessage = emitMessage;

// Middleware
app.use(authMiddleware);
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
