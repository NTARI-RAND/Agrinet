const express = require("express");
const router = express.Router();
const Listing = require("../marketplace/models/listings");
const Transaction = require("../models/transaction");
const User = require("../models/user");

// Export route for peer sync
router.get("/export", async (req, res) => {
  try {
    const listings = await Listing.find();
    const transactions = await Transaction.find();
    const users = await User.find();

    res.json({ listings, transactions, users });
  } catch (err) {
    res.status(500).json({ error: "Export failed" });
  }
});

// Import route for federation sync
router.post("/import", async (req, res) => {
  try {
    const { listings, transactions, users } = req.body;

    const upsertMany = async (Model, items) => {
      for (const item of items) {
        await Model.updateOne(
          { _id: item._id },
          { $set: item },
          { upsert: true }
        );
      }
    };

    await upsertMany(Listing, listings);
    await upsertMany(Transaction, transactions);
    await upsertMany(User, users);

    res.json({ message: "Import successful" });
  } catch (err) {
    res.status(500).json({ error: "Import failed" });
  }
});

module.exports = router;
