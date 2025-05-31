const express = require("express");
const Contract = require("../models/contract");
const router = express.Router();
const cache = new Map();
const axios = require("axios");

// GET Contracts (with caching)
router.get("/", async (req, res) => {
  if (cache.has("contracts")) return res.json(cache.get("contracts"));

  try {
    const contracts = await Contract.find();
    cache.set("contracts", contracts); // Store in cache
    res.json(contracts);
  } catch (error) {
    res.status(500).json({ error: "Database error" });
  }
});

// POST Contract (with webhook)
router.post("/", async (req, res) => {
  try {
    const newContract = new Contract(req.body);
    await newContract.save();

    // Notify Wix that a contract has been created
    await axios.post("https://www.ntari.org/_functions/webhookUpdate", {
      contractId: newContract._id,
      status: "created",
    });

    res.json({ message: "Contract created", data: newContract });
  } catch (error) {
    res.status(500).json({ error: "Error creating contract" });
  }
});

module.exports = router;
