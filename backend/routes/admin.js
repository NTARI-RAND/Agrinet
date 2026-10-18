const express = require("express");
const docClient = require("../lib/dynamodbClient");
const { USER_TABLE_NAME } = require("../models/user");
const { KEY_TABLE_NAME } = require("../models/key");
const router = express.Router();

// Get all users
router.get("/users", async (req, res) => {
    try {
        const data = await docClient
            .scan({ TableName: USER_TABLE_NAME })
            .promise();
        const users = data.Items.map(({ password, ...rest }) => rest);
        res.json(users);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch users" });
    }
});

// Get key usage logs
router.get("/keys", async (req, res) => {
    try {
        const { Items: keys = [] } = await docClient.scan({ TableName: KEY_TABLE_NAME }).promise();
        res.json(keys);
    } catch (err) {
        res.status(500).json({ error: "Failed to fetch keys" });
    }
});

module.exports = router;
