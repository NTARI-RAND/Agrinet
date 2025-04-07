// backend/routes/trendsRoutes.js (filtered and AI insights enabled)
const express = require("express");
const router = express.Router();
const Transaction = require("../models/transaction");
const User = require("../models/user");
const Listing = require("../models/listing");
const { generateAIInsight } = require("../utils/aiTrendHelper");

// Helper: Build date filter
function buildDateFilter(startDate, endDate) {
  const filter = {};
  if (startDate) filter.$gte = new Date(startDate);
  if (endDate) filter.$lte = new Date(endDate);
  return filter;
}

// Top Rated Producers with optional region
router.get("/top-rated", async (req, res) => {
  const { limit = 5, region } = req.query;
  const match = { role: "producer" };
  if (region) match.region = region;
  const result = await User.aggregate([
    { $match: match },
    { $project: { name: 1, reputationScore: 1 } },
    { $sort: { reputationScore: -1 } },
    { $limit: parseInt(limit) }
  ]);
  res.json(result);
});

// Market Volume by Region (filter by date)
router.get("/volume-by-region", async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {};
  if (startDate || endDate) match.createdAt = buildDateFilter(startDate, endDate);
  const result = await Listing.aggregate([
    { $match: match },
    { $group: { _id: "$location", count: { $sum: 1 } } },
    { $sort: { count: -1 } }
  ]);
  res.json(result);
});

// Listings Over Time (filtered)
router.get("/listings-over-time", async (req, res) => {
  const { startDate, endDate } = req.query;
  const match = {};
  if (startDate || endDate) match.createdAt = buildDateFilter(startDate, endDate);
  const result = await Listing.aggregate([
    { $match: match },
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

// AI Trend Insight Trigger
router.get("/ai/insight", async (req, res) => {
  try {
    const { region } = req.query;
    const insights = await generateAIInsight(region);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: "AI trend generation failed" });
  }
});

module.exports = router;
