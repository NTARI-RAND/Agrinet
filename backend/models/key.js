const mongoose = require("mongoose");

const KeySchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  key: { type: String, required: true, unique: true },
  issuedAt: { type: Date, default: Date.now },
  usageCount: { type: Number, default: 0 },
  expiresAt: { type: Date, required: true },
});

module.exports = mongoose.models.Key || mongoose.model("Key", KeySchema);
