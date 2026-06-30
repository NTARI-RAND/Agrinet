require('dotenv').config();
const express = require("express");
const http = require('http');
const { Server } = require("socket.io");
const rateLimit = require("express-rate-limit");
const errorHandler = require("./middleware/errorHandler");
const pool = require("./lib/db");
const {
  register,
  paymentsTotal,
  disputesOpenTotal,
  activeListingsTotal,
  activeUsersTotal
} = require("./lib/metrics");
const { redis, connectRedis } = require("./lib/redis");
const { RedisStore } = require("rate-limit-redis");

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

// Load environment variables
dotenv.config();

const minimal = process.env.MINIMAL_SERVER === 'true';

const app = express();

/* ---------------- STRIPE WEBHOOK FIRST ---------------- */
app.post(
  "/payments/webhook",
  express.raw({ type: "application/json" }),
  require("./routes/webhook")
);
/* ------------------------------------------------------ */

// --- CORS ---
const allowedOrigins = [
  'https://www.ntari.org',
  'http://localhost:3000',
  'http://localhost:3001',
  ...(process.env.ALLOWED_ORIGINS ? process.env.ALLOWED_ORIGINS.split(',') : []),
];
app.use(cors({
  origin: function (origin, callback) {
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    callback(new Error('CORS not allowed for this origin'));
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-API-Key'],
}));
// -----------

/* ----------- normal body parser ----------- */
app.use(express.json());
/* ----------------------------------------------- */

/* ----------- static uploads (local file storage) ----------- */
// Serves files written by lib/storage.js. Reachable via nginx at /api/uploads/...
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
/* ------------------------------------------------------------ */

const tryMount = (route, modPath) => {
  try {
    const mod = require(modPath);
    app.use(route, mod);
  } catch (err) {
    console.warn(`Skipping ${modPath}: ${err.message}`);
  }
};

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'agrinet-api',
    time: new Date().toISOString()
  });
});

app.get("/healthz", async (_req, res) => {
  try {
    await pool.query("SELECT 1");
    res.status(200).json({ ok: true });
  } catch (_error) {
    res.status(500).json({ ok: false });
  }
});

// Server & SSE event stream
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: function (origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
      if (process.env.NODE_ENV !== 'production') return callback(null, true);
      callback(new Error('CORS not allowed for this origin'));
    },
    credentials: true,
  }
});

const jwt = require('./utils/jwt');

io.use((socket, next) => {
  const token = socket.handshake.auth?.token;
  if (!token) return next(new Error('Authentication required'));
  try {
    socket.user = jwt.verify(token, process.env.JWT_SECRET || 'supersecretjwt');
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on("connection", (socket) => {
  console.log("Socket conectado:", socket.id);

  socket.on("user_online", (userId) => {

    socket.userId = userId;

    io.emit("user_online", {
      user_id: userId
    });

  });

  socket.on("join_conversation", (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} entrou na conversa ${conversationId}`);
  });

  socket.on("typing", (data) => {

    const { conversation_id, user_id } = data;

    socket.to(conversation_id).emit("user_typing", {
      conversation_id,
      user_id
    });

  });

  socket.on("send_message", async (data) => {

    const { conversation_id, message, sender_id } = data;

    try {

      const id = require("crypto").randomUUID();

      const [check] = await pool.query(
        `
        SELECT 1
        FROM conversations
        WHERE id = ?
        AND (buyer_id = ? OR seller_id = ?)
        `,
        [conversation_id, sender_id, sender_id]
      );

      if (!check.length) {
        console.log("Mensagem bloqueada: usuário não pertence à conversa");
        return;
      }

      await pool.query(
        `
        INSERT INTO messages (id, conversation_id, sender_id, message)
        VALUES (?, ?, ?, ?)
        `,
        [id, conversation_id, sender_id, message]
      );

      // criar notificação para outros participantes
      const [participants] = await pool.query(
        `
        SELECT buyer_id, seller_id
        FROM conversations
        WHERE id = ?
        `,
        [conversation_id]
      );

      if (participants.length) {

        const { buyer_id, seller_id } = participants[0];

        const receiver =
          sender_id === buyer_id ? seller_id : buyer_id;

        const notificationId = require("crypto").randomUUID();

        await pool.query(
          `
          INSERT INTO notifications (id, user_id, type, message)
          VALUES (?, ?, ?, ?)
          `,
          [
            notificationId,
            receiver,
            "new_message",
            "Nova mensagem recebida"
          ]
        );

      }

      const payload = {
        id,
        conversation_id,
        sender_id,
        message,
        created_at: new Date().toISOString()
      };

      io.to(conversation_id).emit("receive_message", payload);

    } catch (err) {
      console.error("Socket message error:", err);
    }

  });

  socket.on("disconnect", () => {

    if (socket.userId) {
      io.emit("user_offline", {
        user_id: socket.userId
      });
    }

    console.log("Socket desconectado:", socket.id);

  });
});

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

// metrics FIRST
app.get("/metrics", async (req, res) => {
  res.set("Content-Type", register.contentType);
  res.end(await register.metrics());
});

app.use("/auth", require("./routes/authRoutes"));
app.use("/payments", require("./routes/paymentRoutes"));
app.use('/transactions', require('./routes/transactionRoutes'));
app.use('/admin', require('./routes/adminRoutes'));

app.use('/listings', require('./routes/listingRoutes'));
app.use('/posts', require('./routes/postRoutes'));
app.use('/ratings', require('./routes/ratingRoutes'));
app.use('/operators', require('./routes/operatorRoutes'));
app.use('/wallet',   require('./routes/walletRoutes'));
app.use("/conversations", require("./routes/conversationRoutes"));
app.use("/messages", require("./routes/messageRoutes"));
app.use("/notifications", require("./routes/notificationRoutes"));

// Routes
if (!minimal) {
  [
    ['/users', './routes/userRoutes'],
    ['/api/marketplace', './marketplace/marketplace_routes'],
    ['/federation', './federation/federationRoutes'],
  ].forEach(([route, mod]) => tryMount(route, mod));

}

app.use((req, res, next) => {
  res.status(404).json({ error: "Route not found" });
});

// Global error handler (MUST be last middleware)
app.use(errorHandler);

const PORT = process.env.PORT || 5000;

async function start() {
  await connectRedis();

  // Rate limiters require Redis to be connected first
  const globalLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 100,
    store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  });
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 200,
    store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  });
  const paymentLimiter = rateLimit({
    windowMs: 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    store: new RedisStore({ sendCommand: (...args) => redis.sendCommand(args) }),
  });
  app.use(limiter);
  app.use(globalLimiter);
  app.use('/payments', paymentLimiter);

  const knex = require('knex')(require('./knexfile'));
  await knex.migrate.latest();
  console.log('Migrations aplicadas com sucesso');

  server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
}

if (require.main === module) {
  start().catch((err) => {
    console.error("Server startup failed:", err);
    process.exit(1);
  });
}

const expirePendingPayments = require("./jobs/paymentExpirationJob");

setInterval(() => {
  expirePendingPayments();
}, 60 * 1000); // roda a cada 1 minuto

setInterval(async () => {
  try {
    const [[payments]] = await pool.query(
      "SELECT COUNT(*) as count FROM payments"
    );

    const [[disputes]] = await pool.query(
      "SELECT COUNT(*) as count FROM disputes WHERE status='open'"
    );

    const [[listings]] = await pool.query(
      "SELECT COUNT(*) as count FROM listings WHERE status='active'"
    );

    const [[users]] = await pool.query(
      "SELECT COUNT(*) as count FROM users WHERE is_blocked = 0"
    );

    paymentsTotal.set(payments.count);
    disputesOpenTotal.set(disputes.count);
    activeListingsTotal.set(listings.count);
    activeUsersTotal.set(users.count);
  } catch (err) {
    console.error("Metrics refresh failed:", err.message);
  }
}, 15000);

module.exports = { app, server };
