const express = require("express");
const { CONTRACT_TABLE_NAME, createContractItem } = require("../models/contract");
const docClient = require('../lib/dynamodbClient');
const crypto = require('crypto');
const router = express.Router();
const cache = new Map();
const axios = require("axios");

// GET Contracts (with caching)
router.get("/", async (req, res) => {
  if (cache.has("contracts")) return res.json(cache.get("contracts"));

  try {
    const { Items: contracts = [] } = await docClient.scan({ TableName: CONTRACT_TABLE_NAME }).promise();
    cache.set("contracts", contracts); // Store in cache
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// POST Contract (with webhook)
router.post("/", async (req, res) => {
  try {
    const newContract = createContractItem({ ...req.body, id: crypto.randomUUID() });
    await docClient.put({ TableName: CONTRACT_TABLE_NAME, Item: newContract }).promise();
    cache.delete('contracts');

    // Notify Wix that a contract has been created
    await axios.post("https://www.ntari.org/_functions/webhookUpdate", {
      contractId: newContract.id,
      status: "created",
    });

    res.json({ message: "Contract created", data: newContract });
  } catch (error) {
    res.status(500).json({ error: "Error creating contract" });
  }
});

module.exports = router;
