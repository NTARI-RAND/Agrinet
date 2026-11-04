const express = require("express");
const bcrypt = require("../utils/bcrypt");
const jwt = require("../utils/jwt");
const { createUserItem } = require("../models/user");
const { normalizeEmail, createUserWithEmail, findUserByEmail } = require("../models/userEmail");
const { randomUUID } = require('crypto');
const router = express.Router();
try {
  require("dotenv").config();
} catch { /* Environment may be supplied by the process. */ }

// Test Route to Verify authRoutes
router.get("/test", (req, res) => {
    console.log("Test route hit");
    res.status(200).json({ message: "Auth routes are working!" });
});

// Register User
router.post("/register", async (req, res) => {
    try {
        const { username, phone, password } = req.body;
        const email = normalizeEmail(req.body.email);
        if (!email) return res.status(400).json({ error: "Email is required." });
        const hashedPassword = await bcrypt.hash(password, 10);
        const user = createUserItem({ id: randomUUID(), username, email, phone, password: hashedPassword });
        if (!(await createUserWithEmail(user))) {
            return res.status(409).json({ error: "Account could not be created" });
        }
        res.status(201).json({ message: "User registered. Please verify your email/phone." });
    } catch (error) {
        res.status(500).json({ error: "Error registering user." });
    }
});

// Login User
router.post("/login", async (req, res) => {
    try {
        const { email, password } = req.body;
        const user = await findUserByEmail(email);

        if (!user || !(await bcrypt.compare(password, user.password))) {
            return res.status(401).json({ error: "Invalid credentials" });
        }

        const token = jwt.sign({ userId: user.id, role: user.role }, process.env.JWT_SECRET, { expiresIn: "7d" });
        const { password: _password, ...publicUser } = user;
        res.json({ token, user: publicUser });
    } catch (error) {
        res.status(500).json({ error: "Login error." });
    }
});

module.exports = router;
