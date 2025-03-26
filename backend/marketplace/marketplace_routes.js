const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Marketplace Schema
const ListingSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: { type: String, enum: ["product", "service", "plan", "agrotourism"], required: true },
  title: { type: String, required: true },
  description: { type: String },
  price: { type: Number, required: true },
  location: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Listing = mongoose.model("Listing", ListingSchema);

// Create Listing
router.post("/listings", async (req, res) => {
  try {
    const newListing = new Listing(req.body);
    await newListing.save();
    res.status(201).json({ message: "Listing created successfully", listing: newListing });
  } catch (error) {
    res.status(500).json({ error: "Error creating listing" });
  }
});

// Get Listings
router.get("/listings", async (req, res) => {
  try {
    const listings = await Listing.find();
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: "Error fetching listings" });
  }
});

// Broadcast Schema
const BroadcastSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  message: { type: String, required: true },
  geolocation: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Broadcast = mongoose.model("Broadcast", BroadcastSchema);

// Create Broadcast
router.post("/broadcasts", async (req, res) => {
  try {
    const newBroadcast = new Broadcast(req.body);
    await newBroadcast.save();
    res.status(201).json({ message: "Broadcast posted successfully", broadcast: newBroadcast });
  } catch (error) {
    res.status(500).json({ error: "Error posting broadcast" });
  }
});

// Get Broadcasts
router.get("/broadcasts", async (req, res) => {
  try {
    const broadcasts = await Broadcast.find();
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: "Error fetching broadcasts" });
  }
});

// Transaction Schema
const TransactionSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  ratingGiven: { type: Boolean, default: false },
  lastPing: { type: Date, default: Date.now },
  pingCount: { type: Number, default: 0 },
  dialogNotes: { type: String, default: "" },
  dialogConfirmed: { type: Boolean, default: false },
  flaggedForReview: { type: Boolean, default: false }
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

// Create Transaction
router.post("/transactions", async (req, res) => {
  try {
    const newTransaction = new Transaction(req.body);
    await newTransaction.save();
    res.status(201).json({ message: "Transaction initiated", transaction: newTransaction });
  } catch (error) {
    res.status(500).json({ error: "Error initiating transaction" });
  }
});

// Get Transactions
router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().populate("buyerId sellerId listingId");
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Dialog Matching / Transaction Validation
router.post("/transactions/dialog-validate", async (req, res) => {
  try {
    const { transactionId, dialogNotes } = req.body;
    const transaction = await Transaction.findById(transactionId).populate("listingId");

    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    const expectedKeywords = transaction.listingId.title.toLowerCase().split(" ");
    const dialogWords = dialogNotes.toLowerCase().split(" ");
    const matches = expectedKeywords.filter(word => dialogWords.includes(word));

    const confidence = matches.length / expectedKeywords.length;
    transaction.dialogNotes = dialogNotes;

    if (confidence >= 0.6) {
      transaction.dialogConfirmed = true;
      transaction.flaggedForReview = false;
    } else {
      transaction.dialogConfirmed = false;
      transaction.flaggedForReview = true;
    }

    await transaction.save();

    res.json({
      message: "Dialog validation complete",
      dialogConfirmed: transaction.dialogConfirmed,
      flaggedForReview: transaction.flaggedForReview,
      confidence
    });
  } catch (error) {
    res.status(500).json({ error: "Error validating dialog data" });
  }
});

// LBTAS Reputation System
const User = require("../models/User");

// Submit Rating
router.post("/transactions/rate", async (req, res) => {
  try {
    const { transactionId, rating } = req.body;
    if (rating < -1 || rating > 4) {
      return res.status(400).json({ error: "Invalid rating value. Must be between -1 and 4." });
    }

    const transaction = await Transaction.findById(transactionId);
    if (!transaction || transaction.ratingGiven) {
      return res.status(400).json({ error: "Invalid or already rated transaction." });
    }

    const seller = await User.findById(transaction.sellerId);
    seller.reputationScore += rating;
    await seller.save();
    transaction.ratingGiven = true;
    await transaction.save();

    res.json({ message: "Rating submitted successfully", updatedReputation: seller.reputationScore });
  } catch (error) {
    res.status(500).json({ error: "Error submitting rating" });
  }
});

// PING Module - Transaction Progress Tracking
router.post("/transactions/ping", async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) {
      return res.status(404).json({ error: "Transaction not found" });
    }

    transaction.lastPing = new Date();
    transaction.pingCount += 1;
    await transaction.save();

    res.json({ message: "Ping recorded", pingCount: transaction.pingCount, lastPing: transaction.lastPing });
  } catch (error) {
    res.status(500).json({ error: "Error recording ping" });
  }
});

module.exports = router;
