const axios = require("axios");
const { getAllNodes, saveNode } = require("../models/nodeRegistry");
const { importFederatedData } = require("./importHelper");

async function runFederationSync() {
  const nodes = await getAllNodes();
  for (const node of nodes) {
    try {
      const { data } = await axios.get(`${node.url}/federation/export`);
      await importFederatedData(data);
      node.lastSyncAt = new Date().toISOString();
      await saveNode(node);
      console.log(`✅ Synced with ${node.url}`);
    } catch (err) {
      console.error(`❌ Failed to sync with ${node.url}: ${err.message}`);
    }
  }
}

module.exports = runFederationSync;
