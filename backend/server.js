const express = require("express");
const http = require('http');
const { Server } = require('socket.io');
const cors = require("cors");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const authMiddleware = require("./middleware/authMiddleware");
const depositRoutes = require("./routes/depositRoutes");

dotenv.config();

const app = express();
app.use(cors());
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

// Routes
const routes = require('./routes/api');
const authRoutes = require("./routes/authRoutes");
const keyRoutes = require("./routes/keyRoutes");
const contractRoutes = require("./routes/contracts");
const adminRoutes = require("./routes/admin");
const marketplaceRoutes = require("./marketplace/marketplace_routes");

app.use('/', routes);
app.use("/api/auth", authRoutes);
app.use("/api/keys", keyRoutes);
app.use("/api/contracts", contractRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/marketplace", marketplaceRoutes);

// Connect to MongoDB and start server
mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log("MongoDB Connected"))
  .catch(err => console.error("MongoDB Connection Error:", err));

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));


// Federation
const federationRoutes = require('./federation/federationRoutes');
const trendsRoutes = require('./trends/trendsRoutes');

app.use('/federation', federationRoutes);
app.use('/trends', trendsRoutes);

Optionally run federationSyncJob.js on boot:

const runFederationSync = require('./federation/federationSyncJob');
runFederationSync(); // kicks off first run
