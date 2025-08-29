const express = require("express");
const http = require('http');
const { Server } = require('socket.io');
const cors = require("cors");
const dotenv = require("dotenv");
const path = require("path");
const authMiddleware = require("./middleware/authMiddleware");
const depositRoutes = require("./routes/depositRoutes");

// Load environment variables
dotenv.config();

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
app.use("/deposit", depositRoutes);

// Health Check Endpoint
app.get('/health', (req, res) => {
  res.status(200).send('OK');
});

// Server & Socket
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" }
});
global.io = io; // Attach to global for access in other modules

io.on("connection", (socket) => {
  console.log(`🟢 User connected: ${socket.id}`);

  socket.on("disconnect", () => {
    console.log(`🔴 User disconnected: ${socket.id}`);
  });
});

// Middleware
app.use(express.json());
app.use(cors({ origin: "https://www.ntari.org", credentials: true }));
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
