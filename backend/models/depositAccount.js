const mongoose = require("mongoose");

const DepositAccountSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  balance: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  transactionHistory: [
    {
      type: { type: String, enum: ["fund", "withdraw"], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      note: { type: String }
    }
  ]
});

module.exports = mongoose.model("DepositAccount", DepositAccountSchema);
