const express = require("express");
const router = express.Router();
const Transaction = require("../models/transaction");
const User = require("../models/user");
const Listing = require("../models/listing");

router.get("/top-rated", async (req, res) => {
  const limit = parseInt(req.query.limit) || 5;
  const result = await User.aggregate([
    { $match: { role: "producer" } },
    { $project: { name: 1, reputationScore: 1 } },
    { $sort: { reputationScore: -1 } },
    { $limit: limit }
  ]);
  res.json(result);
});

router.get("/volume-by-region", async (req, res) => {
  const result = await Listing.aggregate([
    { $group: { _id: "$location", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  res.json(result);
});

router.get("/listings-over-time", async (req, res) => {
  const result = await Listing.aggregate([
    {
      $group: {
        _id: {
          year: { $year: "$createdAt" },
          month: { $month: "$createdAt" }
        },
        count: { $sum: 1 }
      }
    },
    { $sort: { "_id.year": 1, "_id.month": 1 } }
  ]);
  res.json(result);
});

router.get("/ping-responsiveness", async (req, res) => {
  const result = await Transaction.aggregate([
    {
      $match: { pingCount: { $gte: 2 } }
    },
    {
      $group: {
        _id: "$sellerId",
        avgPingCount: { $avg: "$pingCount" }
      }
    },
    { $sort: { avgPingCount: -1 } }
  ]);
  res.json(result);
});

module.exports = router;
