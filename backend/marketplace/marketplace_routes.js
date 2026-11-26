const express = require("express");
const { randomUUID } = require("crypto");
const docClient = require("../lib/dynamodbClient");
const { LISTINGS_TABLE_NAME, createListingItem } = require("./models/listings");
const {
  BROADCAST_TABLE_NAME,
  createBroadcastItem
} = require("./models/broadcasts");
const {
  TRANSACTION_TABLE_NAME,
  TRANSACTION_FIELDS,
  createTransactionItem
} = require("./models/transaction");
const { USER_TABLE_NAME } = require("../models/user");
const jwt = require("../utils/jwt");

const router = express.Router();

// The caller's account id, from a verified bearer token. The shared API key
// proves only that a request came from an Agrinet client, not who sent it.
function accountId(req) {
  if (req.user?.userId) return req.user.userId;
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return null;
  try {
    return jwt.verify(header.slice(7), process.env.JWT_SECRET).userId || null;
  } catch {
    return null;
  }
}

function requireAccount(req, res, next) {
  const id = accountId(req);
  if (!id) return res.status(401).json({ error: "Sign in to continue" });
  req.accountId = id;
  next();
}

// Loads a transaction the caller is a party to. Sends the error response and
// returns null otherwise.
async function loadOwnTransaction(req, res, transactionId) {
  if (typeof transactionId !== "string" || !transactionId) {
    res.status(400).json({ error: "transactionId is required" });
    return null;
  }
  const { Item: transaction } = await docClient
    .get({ TableName: TRANSACTION_TABLE_NAME, Key: { id: transactionId } })
    .promise();
  if (!transaction) {
    res.status(404).json({ error: "Transaction not found" });
    return null;
  }
  if (transaction.buyerId !== req.accountId && transaction.sellerId !== req.accountId) {
    res.status(403).json({ error: "Not a party to this transaction" });
    return null;
  }
  return transaction;
}

function pickTransactionFields(item) {
  return Object.fromEntries(
    TRANSACTION_FIELDS.filter((field) => field in item).map((field) => [field, item[field]])
  );
}

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

// Create a new service listing following AgriNet protocol
// The listing belongs to the signed-in caller; a userId in the body is ignored.
router.post("/listings", requireAccount, async (req, res) => {
  try {
    const {
      t: title,
      c: category,
      d: description,
      term,
      med = [],
      lr,
      pr,
      composting,
      availability = [],
      tags = [],
      location = ""
    } = req.body;
    const userId = req.accountId;

    if (!title || !category || !description) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    const media = Array.isArray(med) ? med.slice(0, 5) : [];
    const autoTags = Array.from(
      new Set([...tags, category, ...title.split(/\s+/)])
    );
    const id = randomUUID();
    const item = createListingItem({
      id,
      userId,
      type: "service",
      title,
      category,
      description,
      price: term,
      location,
      media,
      logisticsRange: lr,
      processingCategory: pr,
      compostingService: composting,
      availability,
      tags: autoTags
    });

    await docClient.put({ TableName: LISTINGS_TABLE_NAME, Item: item }).promise();
    res
      .status(201)
      .json({ message: "Service posted successfully", listing: item });
  } catch (error) {
    res.status(500).json({ error: "Error posting service" });
  }
});

// Retrieve listings with filtering options
router.get("/listings", async (req, res) => {
  try {
    const { location, type, minPrice, maxPrice, keyword, tag } = req.query;
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
    if (tag) {
      filterExpressions.push("contains(#tags, :tag)");
      expressionAttributeValues[":tag"] = tag;
      expressionAttributeNames["#tags"] = "tags";
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

// Create a new transaction. The caller is the buyer; the seller and title come
// from the listing, never from the request body.
router.post("/transactions", requireAccount, async (req, res) => {
  try {
    const { listingId } = req.body;
    if (typeof listingId !== "string" || !listingId) {
      return res.status(400).json({ error: "listingId is required" });
    }
    const { Item: listing } = await docClient
      .get({ TableName: LISTINGS_TABLE_NAME, Key: { id: listingId } })
      .promise();
    if (!listing || !listing.userId) {
      return res.status(404).json({ error: "Listing not found" });
    }
    if (listing.userId === req.accountId) {
      return res.status(400).json({ error: "Cannot buy your own listing" });
    }
    const id = randomUUID();
    const item = createTransactionItem({
      id,
      buyerId: req.accountId,
      sellerId: listing.userId,
      listingId,
      listingTitle: listing.title
    });
    await docClient.put({ TableName: TRANSACTION_TABLE_NAME, Item: item }).promise();
    res
      .status(201)
      .json({ message: "Transaction initiated", transaction: item });
  } catch (error) {
    res.status(500).json({ error: "Error initiating transaction" });
  }
});

// Release escrow funds
router.post("/transactions/release-escrow", requireAccount, async (req, res) => {
  try {
    const { transactionId } = req.body;
    const transaction = await loadOwnTransaction(req, res, transactionId);
    if (!transaction) return;

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

// Retrieve the caller's own transactions, as buyer or seller
router.get("/transactions", requireAccount, async (req, res) => {
  try {
    const names = Object.fromEntries(TRANSACTION_FIELDS.map((field, i) => [`#f${i}`, field]));
    const params = {
      TableName: TRANSACTION_TABLE_NAME,
      FilterExpression: "buyerId = :me OR sellerId = :me",
      ProjectionExpression: Object.keys(names).join(", "),
      ExpressionAttributeNames: names,
      ExpressionAttributeValues: { ":me": req.accountId }
    };
    const items = [];
    let startKey;
    do {
      const page = await docClient
        .scan(startKey ? { ...params, ExclusiveStartKey: startKey } : params)
        .promise();
      items.push(...(page.Items || []));
      startKey = page.LastEvaluatedKey;
    } while (startKey);
    res.json(items
      .filter((item) => item.buyerId === req.accountId || item.sellerId === req.accountId)
      .map(pickTransactionFields));
  } catch (error) {
    res.status(500).json({ error: "Error fetching transactions" });
  }
});

// Validate dialog content
router.post("/transactions/dialog-validate", requireAccount, async (req, res) => {
  try {
    const { transactionId, dialogNotes } = req.body;
    if (typeof dialogNotes !== "string")
      return res.status(400).json({ error: "dialogNotes must be text" });
    const transaction = await loadOwnTransaction(req, res, transactionId);
    if (!transaction) return;

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
router.post("/transactions/rate", requireAccount, async (req, res) => {
  try {
    const { transactionId, rating, role } = req.body;
    if (!Number.isInteger(rating) || rating < -1 || rating > 4)
      return res
        .status(400)
        .json({ error: "Invalid rating value. Must be between -1 and 4." });

    const transaction = await loadOwnTransaction(req, res, transactionId);
    if (!transaction) return;

    // The caller's role comes from the transaction, not from the request.
    const callerRole = transaction.buyerId === req.accountId ? "buyer" : "seller";
    if (role !== undefined && role !== callerRole)
      return res.status(403).json({ error: "You can only rate as your own role" });
    const ratedFlag = callerRole === "buyer" ? "buyerRated" : "sellerRated";
    const userIdToRate = callerRole === "buyer" ? transaction.sellerId : transaction.buyerId;
    // Creation refuses self-purchase, but rows can also arrive by federation import.
    if (userIdToRate === req.accountId)
      return res.status(403).json({ error: "Cannot rate yourself" });

    // Claim this party's one rating before counting it, so two concurrent
    // requests cannot both count.
    let updated;
    try {
      ({ Attributes: updated } = await docClient.update({
        TableName: TRANSACTION_TABLE_NAME,
        Key: { id: transactionId },
        UpdateExpression: `set ${ratedFlag} = :true`,
        ConditionExpression: `attribute_not_exists(${ratedFlag}) OR ${ratedFlag} = :false`,
        ExpressionAttributeValues: { ":true": true, ":false": false },
        ReturnValues: "ALL_NEW"
      }).promise());
    } catch (error) {
      if (error.code === "ConditionalCheckFailedException")
        return res.status(400).json({ error: "Already rated" });
      throw error;
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

    if (updated.buyerRated && updated.sellerRated) {
      // "status" is a DynamoDB reserved word, so it needs a name placeholder.
      await docClient.update({
        TableName: TRANSACTION_TABLE_NAME,
        Key: { id: transactionId },
        UpdateExpression: "set ratingGiven = :true, #status = :completed",
        ExpressionAttributeNames: { "#status": "status" },
        ExpressionAttributeValues: { ":true": true, ":completed": "completed" }
      }).promise();
    }

    res.json({
      message: "Rating submitted successfully",
      updatedReputation: userResult.Attributes.reputationScore
    });
  } catch (error) {
    res.status(500).json({ error: "Error submitting rating" });
  }
});

// Log transaction activity (PING)
router.post("/transactions/ping", requireAccount, async (req, res) => {
  try {
    const { transactionId } = req.body;
    if (!(await loadOwnTransaction(req, res, transactionId))) return;
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
