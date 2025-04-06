const axios = require("axios");
const NodeRegistry = require("../models/nodeRegistry");
const federationRoutes = require("../routes/federationRoutes");
const Listing = require("../models/marketplace/listing");
const Transaction = require("../models/transaction");
const User = require("../models/user");

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

const syncFromPeers = async () => {
  try {
    const nodes = await NodeRegistry.find();
    for (let node of nodes) {
      const res = await axios.get(`${node.nodeUrl}/federation/export`);
      const { listings, transactions, users } = res.data;

      if (listings) await upsertMany(Listing, listings);
      if (transactions) await upsertMany(Transaction, transactions);
      if (users) await upsertMany(User, users);

      console.log(`✔ Synced data from node: ${node.nodeUrl}`);
    }
  } catch (err) {
    console.error("❌ Federation sync error:", err.message);
  }
};

// Example scheduled interval (every 30 mins)
setInterval(syncFromPeers, 30 * 60 * 1000);

module.exports = { syncFromPeers };
