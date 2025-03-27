const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();

// Schema for marketplace listings
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

// Schema for public broadcast messages
const BroadcastSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  title: { type: String, required: true },
  message: { type: String, required: true },
  geolocation: { type: String },
  createdAt: { type: Date, default: Date.now }
});

const Broadcast = mongoose.model("Broadcast", BroadcastSchema);

// Endpoint to create a new broadcast
router.post("/broadcasts", async (req, res) => {
  try {
    const newBroadcast = new Broadcast(req.body);
    await newBroadcast.save();
    res.status(201).json({ message: "Broadcast posted successfully", broadcast: newBroadcast });
  } catch (error) {
    res.status(500).json({ error: "Error posting broadcast" });
  }
});

// Retrieve all broadcast messages
router.get("/broadcasts", async (req, res) => {
  try {
    const broadcasts = await Broadcast.find();
    res.json(broadcasts);
  } catch (error) {
    res.status(500).json({ error: "Error fetching broadcasts" });
  }
});

// Retrieve listings with filtering options
router.get("/listings", async (req, res) => {
  try {
    const { location, type, minPrice, maxPrice, keyword } = req.query;
    let filter = {};

    // Build dynamic filter object
    if (location) filter.location = new RegExp(location, "i");
    if (type) filter.type = type;
    if (minPrice || maxPrice) filter.price = {};
    if (minPrice) filter.price.$gte = Number(minPrice);
    if (maxPrice) filter.price.$lte = Number(maxPrice);
    if (keyword) filter.title = new RegExp(keyword, "i");

    const listings = await Listing.find(filter);
    res.json(listings);
  } catch (error) {
    res.status(500).json({ error: "Error fetching listings" });
  }
});

// Schema for transactions between users
const TransactionSchema = new mongoose.Schema({
  buyerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  sellerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  listingId: { type: mongoose.Schema.Types.ObjectId, ref: "Listing" },
  status: { type: String, enum: ["pending", "in-progress", "completed"], default: "pending" },
  createdAt: { type: Date, default: Date.now },
  buyerRated: { type: Boolean, default: false },
  sellerRated: { type: Boolean, default: false },
  ratingGiven: { type: Boolean, default: false },
  lastPing: { type: Date, default: Date.now },
  pingCount: { type: Number, default: 0 },
  dialogNotes: { type: String, default: "" },
  dialogConfirmed: { type: Boolean, default: false },
  flaggedForReview: { type: Boolean, default: false },
  escrowLocked: { type: Boolean, default: true }, // Funds are locked by default
  escrowReleasedAt: { type: Date, default: null } // Timestamp of escrow release
});

const Transaction = mongoose.model("Transaction", TransactionSchema);

// Endpoint to create a new transaction
router.post("/transactions", async (req, res) => {
  try {
    const newTransaction = new Transaction(req.body);
    await newTransaction.save();
    res.status(201).json({ message: "Transaction initiated", transaction: newTransaction });
  } catch (error) {
    res.status(500).json({ error: "Error initiating transaction" });
  }
});

// Endpoint to release escrow funds
router.post("/transactions/release-escrow", async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    // Require that both ratings have been given before releasing funds
    if (!transaction.buyerRated || !transaction.sellerRated) {
      return res.status(403).json({ error: "Cannot release escrow until both parties rate the transaction." });
    }

    transaction.escrowLocked = false;
    transaction.escrowReleasedAt = new Date();
    await transaction.save();

    res.json({ message: "Escrow funds released.", transaction });
  } catch (error) {
    res.status(500).json({ error: "Error releasing escrow." });
  }
});

// Retrieve all transactions and populate related references
router.get("/transactions", async (req, res) => {
  try {
    const transactions = await Transaction.find().populate("buyerId sellerId listingId");
    res.json(transactions);
  } catch (error) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Validate dialog content for a transaction using basic confidence logic and scrub rules
router.post("/transactions/dialog-validate", async (req, res) => {
  try {
    const { transactionId, dialogNotes } = req.body;
    const transaction = await Transaction.findById(transactionId).populate("listingId buyerId");
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    // Check how closely the dialog matches the listing title
    const expectedKeywords = transaction.listingId.title.toLowerCase().split(" ");
    const dialogWords = dialogNotes.toLowerCase().split(" ");
    const matches = expectedKeywords.filter(word => dialogWords.includes(word));

    const confidence = matches.length / expectedKeywords.length;
    const userReputation = transaction.buyerId.reputationScore || 0;

    transaction.dialogNotes = dialogNotes;

    // Use confidence and reputation to flag or approve the transaction
    if (confidence >= 0.6 && userReputation >= 0) {
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
      confidence,
      userReputation
    });
  } catch (error) {
    res.status(500).json({ error: "Error validating dialog data" });
  }
});

// Import user model for rating logic
const User = require("../models/User");

// Submit a rating as part of the LBTAS reputation system
router.post("/transactions/rate", async (req, res) => {
  try {
    const { transactionId, rating, role } = req.body;
    if (rating < -1 || rating > 4) return res.status(400).json({ error: "Invalid rating value. Must be between -1 and 4." });

    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    let userToRate;
    // Check who is rating and if they have already submitted a rating
    if (role === "buyer" && !transaction.buyerRated) {
      userToRate = await User.findById(transaction.sellerId);
      transaction.buyerRated = true;
    } else if (role === "seller" && !transaction.sellerRated) {
      userToRate = await User.findById(transaction.buyerId);
      transaction.sellerRated = true;
    } else {
      return res.status(400).json({ error: "Already rated or invalid role" });
    }

    // Update reputation score and mark transaction as rated
    userToRate.reputationScore += rating;
    await userToRate.save();

    if (transaction.buyerRated && transaction.sellerRated) {
      transaction.ratingGiven = true;
      transaction.status = "completed";
    }

    await transaction.save();
    res.json({ message: "Rating submitted successfully", updatedReputation: userToRate.reputationScore });
  } catch (error) {
    res.status(500).json({ error: "Error submitting rating" });
  }
});

// Log transaction activity (PING) to track updates
router.post("/transactions/ping", async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transaction = await Transaction.findById(transactionId);
    if (!transaction) return res.status(404).json({ error: "Transaction not found" });

    transaction.lastPing = new Date();
    transaction.pingCount += 1;
    await transaction.save();

    res.json({ message: "Ping recorded", pingCount: transaction.pingCount, lastPing: transaction.lastPing });
  } catch (error) {
    res.status(500).json({ error: "Error recording ping" });
  }
});

// Export all routes
module.exports = router;
