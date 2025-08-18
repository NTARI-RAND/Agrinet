const mongoose = require("mongoose");

const NodeRegistrySchema = new mongoose.Schema({
  nodeUrl: { type: String, required: true, unique: true },
  region: { type: String },
  contactEmail: { type: String },
  registeredAt: { type: Date, default: Date.now },
  lastSyncAt: { type: Date },
  production: {
    nodeId: { type: String },
    capabilities: [{ type: String }]
  },
  services: {
    educational: { type: Boolean, default: false },
    socialMedia: [{ type: String }],
    extensionPartners: [{ type: String }],
    financial: {
      marketListings: { type: Boolean, default: false },
      grantSearch: { type: Boolean, default: false }
    },
    marketing: {
      onNetwork: { type: Boolean, default: false },
      socialMediaSyndication: { type: Boolean, default: false }
    }
  },
  reputation: { type: Number },
  interoperability: [{ type: String }],
  support: {
    compostingAreas: { type: Boolean, default: false },
    grazingAreas: { type: Boolean, default: false },
    environmentalServices: [{ type: String }],
    laborServices: [{ type: String }],
    collectiveManagement: { type: Boolean, default: false }
  }
});

module.exports = mongoose.model("NodeRegistry", NodeRegistrySchema);
