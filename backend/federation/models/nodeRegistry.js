const mongoose = require("mongoose");

const NodeRegistrySchema = new mongoose.Schema({
  url: { type: String, required: true, unique: true },
  region: { type: String },
  contact: { type: String },
  lastSyncAt: { type: Date, default: null }
});

module.exports = mongoose.model("NodeRegistry", NodeRegistrySchema);
