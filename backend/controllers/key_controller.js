const KeyLibrary = require("../models/KeyLibrary");
const { randomBytes } = require("crypto");

const TRANSMISSION_LIMITS = [3, 6, 9, 12, 365]; // Keys retire after these limits

exports.issueKey = async (req, res) => {
    try {
        const { userId } = req.body;
        const activeKeys = await KeyLibrary.find({ userId, retired: false });

        if (activeKeys.length >= 7) {
            return res.status(400).json({ error: "Max key limit reached" });
        }

        const newKey = new KeyLibrary({
            userId,
            key: generateMcElieseKey(),
            transmissions: 0,
            retired: false,
            issuedAt: new Date(),
        });

        await newKey.save();
        res.status(201).json({ message: "Key issued successfully", data: newKey });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Function to validate key usage and retire expired keys
exports.validateKey = async (req, res) => {
    try {
        const { userId, key } = req.body;
        const userKey = await KeyLibrary.findOne({ userId, key, retired: false });

        if (!userKey) {
            return res.status(400).json({ error: "Invalid or retired key" });
        }

        userKey.transmissions += 1;

        // Check if the key reached its limit
        if (TRANSMISSION_LIMITS.includes(userKey.transmissions)) {
            userKey.retired = true;
            userKey.retiredAt = new Date();
            await userKey.save();

            // Automatically issue a replacement key
            const replacementKey = new KeyLibrary({
                userId,
                key: generateMcElieseKey(),
                transmissions: 0,
                retired: false,
                issuedAt: new Date(),
            });

            await replacementKey.save();
            return res.json({
                message: "Key retired and replaced",
                retiredKey: userKey,
                newKey: replacementKey,
            });
        }

        await userKey.save();
        res.json({ message: "Key validated", keyData: userKey });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Function to handle retry attempts
exports.retryKeyValidation = async (req, res) => {
    try {
        const { userId } = req.body;
        const failedAttempts = await KeyLibrary.countDocuments({ userId, failedAttempts: { $gte: 3 } });

        if (failedAttempts >= 3) {
            return res.status(403).json({ error: "Maximum retries reached. Key locked for 1 hour." });
        }

        await KeyLibrary.updateMany({ userId }, { $inc: { failedAttempts: 1 } });
        res.json({ message: "Retry attempt logged" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Function to generate McEliese keys
function generateMcElieseKey() {
    // 32 bytes of CSPRNG output; Math.random() is predictable and yielded
    // only ~67 bits drawn from a non-cryptographic generator.
    return randomBytes(32).toString("base64url");
}
