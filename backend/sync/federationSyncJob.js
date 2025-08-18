const axios = require("axios");
const NodeRegistry = require("../models/nodeRegistry");
const { importFederatedData } = require("./importHelper");

async function runFederationSync() {
  const nodes = await NodeRegistry.find();
  for (const node of nodes) {
    try {
      const { data } = await axios.get(`${node.nodeUrl}/federation/export`);
      await importFederatedData(data);
      node.lastSyncAt = new Date();
      await node.save();
      console.log(`✅ Synced with ${node.nodeUrl}`);
    } catch (err) {
      console.error(`❌ Failed to sync with ${node.nodeUrl}: ${err.message}`);
    }
  }
}

module.exports = runFederationSync;
