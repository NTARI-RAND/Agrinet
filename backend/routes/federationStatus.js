const express = require("express");
const router = express.Router();
const { getAllNodes } = require("../models/nodeRegistry");
const axios = require("axios");

router.get("/federation/status", async (req, res) => {
  try {
    const nodes = await getAllNodes();
    const checks = await Promise.all(nodes.map(async (node) => {
      const url = node.url;
      try {
        const { data } = await axios.get(`${url}/federation/export`, { timeout: 5000 });
        return {
          node: url,
          status: "ONLINE",
          listings: data.listings?.length || 0,
          transactions: data.transactions?.length || 0,
          users: data.users?.length || 0,
          lastSync: node.lastSyncAt
        };
      } catch (err) {
        return {
          node: url,
          status: "OFFLINE",
          error: err.message,
          lastSync: node.lastSyncAt
        };
      }
    }));

    res.json({ federationHealth: checks });
  } catch (err) {
    res.status(500).json({ error: "Failed to validate federation status" });
  }
});

module.exports = router;
