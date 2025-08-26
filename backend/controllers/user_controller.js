const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const { randomUUID } = require("crypto");
const docClient = require("../lib/dynamodbClient");
const { USER_TABLE_NAME, createUserItem } = require("../models/user");

exports.registerUser = async (req, res) => {
    try {
        const { name, email, location, role, password, phone } = req.body;
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = Math.floor(100000 + Math.random() * 900000).toString();

        const userItem = createUserItem({
            id: randomUUID(),
            username: name,
            email,
            phone,
            password: hashedPassword,
            verified: false,
            verificationCode,
            location,
            role,
            reputationScore: 0,
            reputationWeight: 0
        });

        await docClient
            .put({ TableName: USER_TABLE_NAME, Item: userItem })
            .promise();

        res.status(201).json({ message: "User registered successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.verifyUser = async (req, res) => {
    try {
        const { email, verificationCode } = req.body;
        const scanParams = {
            TableName: USER_TABLE_NAME,
            FilterExpression: "email = :email",
            ExpressionAttributeValues: { ":email": email }
        };
        const result = await docClient.scan(scanParams).promise();
        const user = result.Items && result.Items[0];

        if (!user) return res.status(404).json({ error: "User not found" });
        if (user.verificationCode !== verificationCode)
            return res.status(400).json({ error: "Invalid code" });

        await docClient
            .update({
                TableName: USER_TABLE_NAME,
                Key: { id: user.id },
                UpdateExpression: "SET verified = :v REMOVE verificationCode",
                ExpressionAttributeValues: { ":v": true }
            })
            .promise();

        res.json({ message: "User verified successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
