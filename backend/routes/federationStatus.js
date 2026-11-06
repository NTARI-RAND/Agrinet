const express = require("express");
const router = express.Router();
const dynamodbClient = require("../lib/dynamodbClient");
const { inspectExport } = require('../sync/exportPages');
const { scanItems } = require('../lib/collectionPage');

router.get("/federation/status", async (req, res) => {
  try {
    const checks = [];
    for await (const node of scanItems(dynamodbClient, { TableName: 'NodeRegistry' })) {
      const url = node.nodeUrl || node.url;
      try {
        const counts = await inspectExport(url);
        checks.push({
          node: url,
          status: "ONLINE",
          ...counts,
          lastSync: node.lastSyncAt,
        });
      } catch (err) {
        checks.push({
          node: url,
          status: "OFFLINE",
          error: err.message,
          listings: 0,
          transactions: 0,
          users: 0,
          lastSync: node.lastSyncAt,
        });
      }
    }
    res.json({ federationHealth: checks, exportMode: 'read-only', usersExported: false });
  } catch (err) {
    res.status(500).json({ error: "Failed to validate federation status" });
  }
});

module.exports = router;
