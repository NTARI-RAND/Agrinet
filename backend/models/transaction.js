const mongoose = require("mongoose");

const TransactionSchema = new mongoose.Schema({
  contractId: { type: mongoose.Schema.Types.ObjectId, ref: "Contract" },
  consumerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  producerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  rating: { type: Number, min: -1, max: 4 }, // LBTAS rating system
  status: { type: String, enum: ["pending", "completed"], default: "pending" },
});

// Fix: Prevent OverwriteModelError in dev/hot-reload/multiple import environments
module.exports = mongoose.models.Transaction || mongoose.model("Transaction", TransactionSchema);
