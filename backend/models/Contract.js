const mongoose = require("mongoose");

const ContractSchema = new mongoose.Schema({
  producerId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
  type: String,  // e.g., "Tomato"
  variety: String, // e.g., "Roma"
  category: { type: String, enum: ["food", "pharmaceuticals", "fibers", "chemicals", "minerals", "ornamentals", "environmental"] },
  amountNeeded: String,
  dateNeeded: Date,
  pingRate: String, // daily, weekly, or monthly
  status: { type: String, enum: ["open", "in progress", "completed"], default: "open" },
});

module.exports = mongoose.model("Contract", ContractSchema);
