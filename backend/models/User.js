const mongoose = require("mongoose");

const UserSchema = new mongoose.Schema({
  username: { type: String, required: true, unique: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, unique: true },
  password: { type: String, required: true },
  verified: { type: Boolean, default: false },
  location: { type: String, required: true },
  role: { type: String, enum: ["producer", "consumer", "admin"], deafult: "consumer" },
  reputationScore: { type: Number, default: 0 },  // LBTAS Score
});

module.exports = mongoose.model("User", UserSchema);
