const express = require("express");
const crypto = require("crypto");
const Key = require("../models/Key");
const router = express.Router();

// Generate a secure key (McEliese Method Alternative)
function generateKey() {
    return crypto.randomBytes(16).toString("hex");
}

// Issue Keys to User
router.post("/issue-key", async (req, res) => {
    try {
        const { userId } = req.body;

        // Generate 7 keys per user
        let keys = [];
        for (let i = 0; i < 7; i++) {
            let newKey = new Key({
                userId,
                key: generateKey(),
                expiresAt: new Date(Date.now() + Math.floor(Math.random() * (365 * 24 * 60 * 60 * 1000))) // 3 to 365 days
            });
            keys.push(newKey);
        }

        await Key.insertMany(keys);
        res.status(201).json({ message: "Keys issued successfully.", keys });
    } catch (error) {
        res.status(500).json({ error: "Error issuing keys." });
    }
});

// Validate Key
router.post("/validate-key", async (req, res) => {
    try {
        const { key } = req.body;
        const validKey = await Key.findOne({ key });

        if (!validKey) {
            return res.status(401).json({ error: "Invalid key." });
        }

        if (validKey.usageCount >= 7) {
            return res.status(403).json({ error: "Key has reached usage limit." });
        }

        validKey.usageCount += 1;
        await validKey.save();
        res.json({ message: "Key validated.", validKey });
    } catch (error) {
        res.status(500).json({ error: "Key validation error." });
    }
});

module.exports = router;
