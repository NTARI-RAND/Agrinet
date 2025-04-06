const mongoose = require("mongoose");
const Listing = require("../models/marketplace/listing");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const NodeRegistry = require("../models/nodeRegistry");

const TransactionLog = mongoose.model("TransactionLog", TransactionLogSchema);
module.exports = TransactionLog;

const TransactionLogSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, enum: ["ping", "rating", "status_change", "flag", "escrow_release"] },
  note: { type: String },
  timestamp: { type: Date, default: Date.now }
});

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
