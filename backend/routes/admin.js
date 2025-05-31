const express = require("express");
const User = require("../models/user");
const Key = require("../models/key");
const router = express.Router();

// Get all users
router.get("/users", async (req, res) => {
    const users = await User.find().select("-password");
    res.json(users);
});

// Get key usage logs
router.get("/keys", async (req, res) => {
    const keys = await Key.find().populate("userId", "username email");
    res.json(keys);
});

module.exports = router;
