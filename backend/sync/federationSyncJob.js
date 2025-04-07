const axios = require("axios");
const NodeRegistry = require("../models/nodeRegistry");
const { importFederatedData } = require("./importHelper");

async function runFederationSync() {
  const nodes = await NodeRegistry.find();
  for (const node of nodes) {
    try {
      const { data } = await axios.get(`${node.url}/export`);
      const result = await importFederatedData(data);
      node.lastSyncAt = new Date();
      await node.save();
      console.log(`✅ Synced with ${node.url}`);
    } catch (err) {
      console.error(`❌ Failed to sync with ${node.url}: ${err.message}`);
    }
  }
}

module.exports = runFederationSync;
