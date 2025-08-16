const express = require("express");
const { randomUUID } = require("crypto");
const docClient = require("../lib/dynamodbClient");
const { LISTINGS_TABLE_NAME } = require("./models/listings");
const {
  BROADCAST_TABLE_NAME,
  createBroadcastItem
} = require("./models/broadcasts");
const {
  TRANSACTION_TABLE_NAME,
  createTransactionItem
} = require("./models/transaction");
const { USER_TABLE_NAME } = require("../models/user");

const router = express.Router();

// Create a new broadcast
router.post("/broadcasts", async (req, res) => {
  try {
    const id = randomUUID();
    const item = createBroadcastItem({ id, ...req.body });
    await docClient.put({ TableName: BROADCAST_TABLE_NAME, Item: item }).promise();
    res
      .status(201)
      .json({ message: "Broadcast posted successfully", broadcast: item });
  } catch (error) {
    res.status(500).json({ error: "Error posting broadcast" });
  }
});

// Retrieve all broadcast messages
router.get("/broadcasts", async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: BROADCAST_TABLE_NAME }).promise();
    res.json(data.Items || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching broadcasts" });
  }
});

// Retrieve listings with filtering options
router.get("/listings", async (req, res) => {
  try {
    const { location, type, minPrice, maxPrice, keyword } = req.query;
    const params = { TableName: LISTINGS_TABLE_NAME };
    const filterExpressions = [];
    const expressionAttributeValues = {};
    const expressionAttributeNames = {};

    if (location) {
      filterExpressions.push("contains(#location, :location)");
      expressionAttributeValues[":location"] = location;
      expressionAttributeNames["#location"] = "location";
    }
    if (type) {
      filterExpressions.push("#type = :type");
      expressionAttributeValues[":type"] = type;
      expressionAttributeNames["#type"] = "type";
    }
    if (minPrice) {
      filterExpressions.push("#price >= :minPrice");
      expressionAttributeValues[":minPrice"] = Number(minPrice);
      expressionAttributeNames["#price"] = "price";
    }
    if (maxPrice) {
      filterExpressions.push("#price <= :maxPrice");
      expressionAttributeValues[":maxPrice"] = Number(maxPrice);
      expressionAttributeNames["#price"] = "price";
    }
    if (keyword) {
      filterExpressions.push("contains(#title, :keyword)");
      expressionAttributeValues[":keyword"] = keyword;
      expressionAttributeNames["#title"] = "title";
    }

    if (filterExpressions.length) {
      params.FilterExpression = filterExpressions.join(" AND ");
      params.ExpressionAttributeValues = expressionAttributeValues;
      params.ExpressionAttributeNames = expressionAttributeNames;
    }

    const data = await docClient.scan(params).promise();
    res.json(data.Items || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching listings" });
  }
});

// Create a new transaction
router.post("/transactions", async (req, res) => {
  try {
    const id = randomUUID();
    const item = createTransactionItem({ id, ...req.body });
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: item }).promise();
    res
      .status(201)
      .json({ message: "Transaction initiated", transaction: item });
  } catch (error) {
    res.status(500).json({ error: "Error initiating transaction" });
  }
});

// Release escrow funds
router.post("/transactions/release-escrow", async (req, res) => {
  try {
    const { transactionId } = req.body;
    const { Item: transaction } = await docClient
      .get({ TableName: TRANSACTION_TABLE_NAME, Key: { id: transactionId } })
      .promise();
    if (!transaction)
      return res.status(404).json({ error: "Transaction not found" });

    if (!transaction.buyerRated || !transaction.sellerRated) {
      return res.status(403).json({
        error: "Cannot release escrow until both parties rate the transaction."
      });
    }

    const updateParams = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression: "set escrowLocked = :false, escrowReleasedAt = :now",
      ExpressionAttributeValues: {
        ":false": false,
        ":now": new Date().toISOString()
      },
      ReturnValues: "ALL_NEW"
    };
    const result = await docClient.update(updateParams).promise();
    res.json({
      message: "Escrow funds released.",
      transaction: result.Attributes
    });
  } catch (error) {
    res.status(500).json({ error: "Error releasing escrow." });
  }
});

// Retrieve all transactions
router.get("/transactions", async (req, res) => {
  try {
    const data = await docClient
      .scan({ TableName: TRANSACTION_TABLE_NAME })
      .promise();
    res.json(data.Items || []);
  } catch (error) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Validate dialog content
router.post("/transactions/dialog-validate", async (req, res) => {
  try {
    const { transactionId, dialogNotes } = req.body;
    const { Item: transaction } = await docClient
      .get({ TableName: TRANSACTION_TABLE_NAME, Key: { id: transactionId } })
      .promise();
    if (!transaction)
      return res.status(404).json({ error: "Transaction not found" });

    const { Item: buyer } = await docClient
      .get({ TableName: USER_TABLE_NAME, Key: { id: transaction.buyerId } })
      .promise();
    const userReputation = buyer?.reputationScore || 0;

    const expectedKeywords = (transaction.listingTitle || "")
      .toLowerCase()
      .split(" ");
    const dialogWords = dialogNotes.toLowerCase().split(" ");
    const matches = expectedKeywords.filter(word => dialogWords.includes(word));
    const confidence =
      expectedKeywords.length > 0 ? matches.length / expectedKeywords.length : 0;

    const dialogConfirmed = confidence >= 0.6 && userReputation >= 0;
    const flaggedForReview = !dialogConfirmed;

    const updateParams = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression:
        "set dialogNotes = :notes, dialogConfirmed = :confirmed, flaggedForReview = :flagged",
      ExpressionAttributeValues: {
        ":notes": dialogNotes,
        ":confirmed": dialogConfirmed,
        ":flagged": flaggedForReview
      },
      ReturnValues: "ALL_NEW"
    };
    const result = await docClient.update(updateParams).promise();

    res.json({
      message: "Dialog validation complete",
      dialogConfirmed: result.Attributes.dialogConfirmed,
      flaggedForReview: result.Attributes.flaggedForReview,
      confidence,
      userReputation
    });
  } catch (error) {
    res.status(500).json({ error: "Error validating dialog data" });
  }
});

// Submit a rating
router.post("/transactions/rate", async (req, res) => {
  try {
    const { transactionId, rating, role } = req.body;
    if (rating < -1 || rating > 4)
      return res
        .status(400)
        .json({ error: "Invalid rating value. Must be between -1 and 4." });

    const { Item: transaction } = await docClient
      .get({ TableName: TRANSACTION_TABLE_NAME, Key: { id: transactionId } })
      .promise();
    if (!transaction)
      return res.status(404).json({ error: "Transaction not found" });

    let userIdToRate;
    let updateExpression;
    const expressionAttributeValues = { ":true": true };

    if (role === "buyer" && !transaction.buyerRated) {
      userIdToRate = transaction.sellerId;
      updateExpression = "set buyerRated = :true";
    } else if (role === "seller" && !transaction.sellerRated) {
      userIdToRate = transaction.buyerId;
      updateExpression = "set sellerRated = :true";
    } else {
      return res.status(400).json({ error: "Already rated or invalid role" });
    }

    const userUpdateParams = {
      TableName: USER_TABLE_NAME,
      Key: { id: userIdToRate },
      UpdateExpression:
        "set reputationScore = if_not_exists(reputationScore, :zero) + :rating",
      ExpressionAttributeValues: { ":rating": rating, ":zero": 0 },
      ReturnValues: "UPDATED_NEW"
    };
    const userResult = await docClient.update(userUpdateParams).promise();

    const bothRated =
      (role === "buyer" && transaction.sellerRated) ||
      (role === "seller" && transaction.buyerRated);
    if (bothRated) {
      updateExpression += ", ratingGiven = :true, status = :completed";
      expressionAttributeValues[":completed"] = "completed";
    }

    const transactionUpdateParams = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression: updateExpression,
      ExpressionAttributeValues: expressionAttributeValues,
      ReturnValues: "ALL_NEW"
    };
    await docClient.update(transactionUpdateParams).promise();

    res.json({
      message: "Rating submitted successfully",
      updatedReputation: userResult.Attributes.reputationScore
    });
  } catch (error) {
    res.status(500).json({ error: "Error submitting rating" });
  }
});

// Log transaction activity (PING)
router.post("/transactions/ping", async (req, res) => {
  try {
    const { transactionId } = req.body;
    const updateParams = {
      TableName: TRANSACTION_TABLE_NAME,
      Key: { id: transactionId },
      UpdateExpression:
        "set lastPing = :now, pingCount = if_not_exists(pingCount, :zero) + :inc",
      ExpressionAttributeValues: {
        ":now": new Date().toISOString(),
        ":inc": 1,
        ":zero": 0
      },
      ReturnValues: "UPDATED_NEW"
    };
    const result = await docClient.update(updateParams).promise();
    res.json({
      message: "Ping recorded",
      pingCount: result.Attributes.pingCount,
      lastPing: result.Attributes.lastPing
    });
  } catch (error) {
    res.status(500).json({ error: "Error recording ping" });
  }
});

module.exports = router;
