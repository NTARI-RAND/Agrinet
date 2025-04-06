const mongoose = require("mongoose");

const TransactionLogSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, enum: ["ping", "rating", "status_change", "flag", "escrow_release"] },
  note: { type: String },
  timestamp: { type: Date, default: Date.now }
});

module.exports = mongoose.model("TransactionLog", TransactionLogSchema);
module.exports = TransactionLog;

// backend/utils/logHelper.js
const TransactionLog = require("../models/transactionLog");

exports.logTransactionEvent = async ({ transactionId, actorId, action, note }) => {
  try {
    const entry = new TransactionLog({ transactionId, actorId, action, note });
    await entry.save();
  } catch (err) {
    console.error("Log save error:", err);
  }
};

// backend/routes/logRoutes.js
const express = require("express");
const router = express.Router();
const TransactionLog = require("../models/transactionLog");
const authMiddleware = require("../middleware/authMiddleware");

// Admin: view all logs or filter by transactionId
router.get("/logs", authMiddleware, async (req, res) => {
  try {
    const { transactionId } = req.query;
    const filter = transactionId ? { transactionId } : {};
    const logs = await TransactionLog.find(filter).populate("actorId").sort({ timestamp: -1 });
    res.json(logs);
  } catch (error) {
    res.status(500).json({ error: "Error retrieving logs" });
  }
});

module.exports = router;

// backend/routes/federationRoutes.js
const express = require("express");
const router = express.Router();
const Listing = require("../models/marketplace/listing");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const NodeRegistry = require("../models/nodeRegistry");

// Export core objects
router.get("/export", async (req, res) => {
  try {
    const listings = await Listing.find();
    const transactions = await Transaction.find();
    const users = await User.find({}, "_id email reputationScore role updatedAt");
    res.json({ listings, transactions, users });
  } catch (error) {
    res.status(500).json({ error: "Export error" });
  }
});

// Import with timestamp/CRDT conflict resolution
router.post("/import", async (req, res) => {
  try {
    const { listings, transactions, users } = req.body;

    const upsertMany = async (Model, items, key = "_id") => {
      for (let item of items) {
        const existing = await Model.findOne({ [key]: item[key] });
        if (!existing) {
          await Model.create(item);
        } else if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
          await Model.updateOne({ [key]: item[key] }, item);
        }
      }
    };
    
    if (listings) await upsertMany(Listing, listings);
    if (transactions) await upsertMany(Transaction, transactions);
    if (users) await upsertMany(User, users);
    
    res.json({ message: "Federated data imported with conflict resolution" });
  } catch (error) {
    res.status(500).json({ error: "Import error" });
  }
});

// Node registry CRUD
router.post("/node/register", async (req, res) => {
  try {
    const { nodeUrl, region, contactEmail } = req.body;
    const node = await NodeRegistry.create({ nodeUrl, region, contactEmail });
    res.json({ message: "Node registered", node });
  } catch (error) {
    res.status(500).json({ error: "Node registration error" });
  }
});

router.get("/nodes", async (req, res) => {
  try {
    const nodes = await NodeRegistry.find();
    res.json(nodes);
  } catch (error) {
    res.status(500).json({ error: "Error fetching nodes" });
  }
});

module.exports = router;

// backend/models/nodeRegistry.js
const mongoose = require("mongoose");

const NodeRegistrySchema = new mongoose.Schema({
  nodeUrl: { type: String, required: true, unique: true },
  region: { type: String },
  contactEmail: { type: String },
  registeredAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model("NodeRegistry", NodeRegistrySchema);
