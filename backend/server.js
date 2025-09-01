let express, cors;
try {
  express = require('express');
  cors = require('cors');
} catch (err) {
  const http = require('http');
  try { require('dotenv').config(); } catch {}
  const server = http.createServer((req, res) => {
    if (req.url === '/health') {
      res.writeHead(200);
      res.end('OK');
    } else {
      res.writeHead(404);
      res.end('Not Found');
    }
  });
  const PORT = process.env.PORT || 5000;
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  module.exports = { app: null, server };
}
if (express && cors) {
const http = require('http');
try { require('dotenv').config(); } catch {}

const path = require("path");
const authMiddleware = require("./middleware/authMiddleware");
const depositRoutes = require("./routes/depositRoutes");


const app = express();

// --- PRODUCTION-READY CORS RESTRICTION ---
// Allowed origins are configured via the ALLOWED_ORIGINS environment variable.
// In development, always allow the local frontend running on port 3000.
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',')
  : ['https://www.ntari.org'];

if (process.env.NODE_ENV !== 'production') {
  allowedOrigins.push('http://localhost:3000');
}

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
app.use("/deposit", depositRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Server & SSE event stream
const server = http.createServer(app);

// Simple Server-Sent Events implementation
const sseClients = new Set();
const conversationClients = new Map();

app.get('/events', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  sseClients.add(res);
  req.on('close', () => sseClients.delete(res));
});

app.get('/stream/:conversationId', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    Connection: 'keep-alive'
  });
  const { conversationId } = req.params;
  if (!conversationClients.has(conversationId)) {
    conversationClients.set(conversationId, new Set());
  }
  conversationClients.get(conversationId).add(res);
  req.on('close', () => {
    const set = conversationClients.get(conversationId);
    if (set) set.delete(res);
  });
});

function broadcast(event, data, conversationId) {
  const payload = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  if (conversationId) {
    const set = conversationClients.get(conversationId);
    if (set) set.forEach(res => res.write(payload));
  } else {
    sseClients.forEach(res => res.write(payload));
  }
}
global.broadcast = broadcast;

// Conversation-scoped Server-Sent Events implementation
const conversationStreams = new Map();

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
const routes = require('./routes/api');
const authRoutes = require("./routes/authRoutes");
const keyRoutes = require("./routes/keyRoutes");
const contractRoutes = require("./routes/contracts");
const adminRoutes = require("./routes/admin");
const marketplaceRoutes = require("./marketplace/marketplace_routes");
const userRoutes = require('./routes/userRoutes');
const productRoutes = require('./routes/products');
const broadcastRoutes = require('./routes/broadcastRoutes');
const smsRoutes = require('./routes/smsRoutes');
const cartRoutes = require('./routes/cartRoutes');
const orderRoutes = require('./routes/orderRoutes');
const subscriptionRoutes = require('./routes/subscriptionRoutes');
const conversationRoutes = require('./routes/conversationRoutes');
const communicationRoutes = require('./routes/communicationRoutes');
const inventoryRoutes = require('./routes/inventoryRoutes');
const locationRoutes = require('./routes/locationRoutes');

app.use('/', routes);
app.use("/api/auth", authRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/marketplace", marketplaceRoutes);
app.use('/users', userRoutes);
app.use('/products', productRoutes);
app.use('/broadcast', broadcastRoutes);
app.use('/sms', smsRoutes);
app.use('/cart', cartRoutes);
app.use('/orders', orderRoutes);
app.use('/subscriptions', subscriptionRoutes);
app.use('/conversations', conversationRoutes);
app.use('/messages', communicationRoutes);
app.use('/inventory', inventoryRoutes);
app.use('/api/location', locationRoutes);

// Federation
const federationRoutes = require('./federation/federationRoutes');
const trendsRoutes = require('./trends/trendsRoutes');

app.use('/federation', federationRoutes);
app.use('/trends', trendsRoutes);

// Optionally run federation sync job on boot
const runFederationSync = require('./federation/federationSyncJob');

const PORT = process.env.PORT || 5000;
if (require.main === module) {
  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
runFederationSync(); // kicks off first run
}

module.exports = { app, server };
}
