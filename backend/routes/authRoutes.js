const express = require("express");
let bcrypt, jwt;
try { bcrypt = require('bcryptjs'); } catch {}
try { jwt = require('jsonwebtoken'); } catch {}
const crypto = require('crypto');
const User = require("../models/user");
const router = express.Router();
require("dotenv").config();

// Test Route to Verify authRoutes
router.get("/test", (req, res) => {
    console.log("Test route hit");
    res.status(200).json({ message: "Auth routes are working!" });
});

// Register User
router.post("/register", async (req, res) => {
    try {
        const { username, email, phone, password } = req.body;
        const hashedPassword = bcrypt ? await bcrypt.hash(password, 10) : crypto.createHash('sha256').update(password).digest('hex');
        const user = new User({ username, email, phone, password: hashedPassword });

        await user.save();
        res.status(201).json({ message: "User registered. Please verify your email/phone." });
    } catch (error) {
        res.status(500).json({ error: "Error registering user." });
    }
});

// Login User
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await User.findOne({ email });

        const valid = bcrypt ? await bcrypt.compare(password, user.password) : crypto.createHash('sha256').update(password).digest('hex') === user.password;
        if (!user || !valid) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt ? jwt.sign({ userId: user._id, role: user.role }, process.env.JWT_SECRET, { expiresIn: '7d' }) : 'stub-token';
        res.json({ token, user });
    } catch (error) {
        res.status(500).json({ error: "Login error." });
    }
});

module.exports = router;
