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

// Export core objects
router.get("/export", async (req, res) => {
  try {
    const listings = await Listing.find();
    const transactions = await Transaction.find();
    const users = await User.find({}, "_id email reputationScore role");
    res.json({ listings, transactions, users });
  } catch (error) {
    res.status(500).json({ error: "Export error" });
  }
});

// Import core objects
router.post("/import", async (req, res) => {
  try {
    const { listings, transactions, users } = req.body;
    if (listings) await Listing.insertMany(listings);
    if (transactions) await Transaction.insertMany(transactions);
    if (users) await User.insertMany(users);
    res.json({ message: "Data imported successfully" });
  } catch (error) {
    res.status(500).json({ error: "Import error" });
  }
});

module.exports = router;
