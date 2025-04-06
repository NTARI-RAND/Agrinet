const mongoose = require("mongoose");

const TransactionLogSchema = new mongoose.Schema({
  transactionId: { type: mongoose.Schema.Types.ObjectId, ref: "Transaction" },
  actorId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  action: { type: String, enum: ["ping", "rating", "status_change", "flag", "escrow_release"] },
  note: { type: String },
  timestamp: { type: Date, default: Date.now }
});

const TransactionLog = mongoose.model("TransactionLog", TransactionLogSchema);
module.exports = TransactionLog;



