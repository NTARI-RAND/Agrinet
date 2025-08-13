const dynamoClient = require('../utils/dynamoClient');
const { PutItemCommand, GetItemCommand, QueryCommand, UpdateItemCommand } = require('@aws-sdk/client-dynamodb');
const { v4: uuidv4 } = require('uuid');
const bcrypt = require("bcrypt");


// Helper: Generate a 6-digit OTP code
function generateOTP() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

// Helper: Send OTP (stub, replace with real email/SMS logic in production)
async function sendOTP(email, phone, code) {
    // For local dev, just log the OTP to the console
    console.log(`Send OTP ${code} to ${email || phone}`);
}

// Register a new user (local dynamoDB version)
exports.registerUser = async (req, res) => {
    console.log("registerUser called", req.body);
    try {
        const { name, email, phone, password, location, role } = req.body;
        if (!name || !email || !phone || !location || !role || !password) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        console.log("Passed validation");
        // Check if user exists by email
        const getParams = {
            TableName: 'Users',
            Key: { email: { S: email } }
        };
        const existing = await dynamoClient.send(new GetItemCommand(getParams));
        if (existing.Item) {
            return res.status(409).json({ error: "Email already registered" });
        }
        console.log("Passed duplicate check");
        // Hash password
        const hashedPassword = await bcrypt.hash(password, 10);
        const verificationCode = generateOTP();
        const id = email; // or uuidv4() if you use id as PK

        // Debug log before inserting
        console.log("Registering user with:", {
        id, name, email, phone, password: '[HIDDEN]', location, role, verificationCode
        });

        // Insert user
        const putParams = {
            TableName: 'Users',
            Item: {
                //id: { S: id },
                email: { S: email },
                name: { S: name },
                phone: { S: phone },
                password: { S: hashedPassword },
                location: { S: location },
                role: { S: role },
                verified: { BOOL: false },
                verificationCode: { S: verificationCode }
            }
        };
        await dynamoClient.send(new PutItemCommand(putParams));
        await sendOTP(email, phone, verificationCode);
        res.status(201).json({ message: "User registered successfully. Please verify your account with the OTP sent to your email/phone." });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

// Verify a user's OTP (local dynamoDB version)
exports.verifyUser = async (req, res) => {
    try {
        const { email, verificationCode, otp } = req.body;
        const code = verificationCode || otp;

        // Get user by email
        const getParams = {
            TableName: 'Users',
            Key: { email: { S: email } }
        };
        const result = await dynamoClient.send(new GetItemCommand(getParams));
        const user = result.Item;
        if (!user) {
            return res.status(404).json({ error: "User not found" });
        }
        if (user.verificationCode.S !== String(code)) {
            return res.status(400).json({ error: "Invalid code" });
        }

        // Update user as verified
        const updateParams = {
            TableName: 'Users',
            Key: { email: { S: email } },
            UpdateExpression: "SET verified = :v, verificationCode = :null",
            ExpressionAttributeValues: {
                ":v": { BOOL: true },
                ":null": { NULL: true }
            }
        };
        await dynamoClient.send(new UpdateItemCommand(updateParams));
        res.json({ message: "User verified successfully" });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
