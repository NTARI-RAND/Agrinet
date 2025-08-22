const axios = require("axios");
const dynamodbClient = require("../lib/dynamodbClient");
const Listing = require("../marketplace/models/listings");
const Transaction = require("../models/transaction");
const User = require("../models/user");
const { getAllNodes } = require("../models/nodeRegistry");
const federationRoutes = require("../routes/federationRoutes");
const Listing = require("../marketplace/models/listings");

const NODE_REGISTRY_TABLE = "NodeRegistry";

const upsertMany = async (Model, items, key = "_id") => {
  for (let item of items) {
    const existing = await Model.findOne({ [key]: item[key] });
    if (!existing) {
      await Model.create(item);
    } else if (new Date(item.updatedAt) > new Date(existing.updatedAt)) {
      await Model.updateOne({ [key]: item[key] }, item);
    }
  }
};

const syncFromPeers = async () => {
  try {
    const { Items: nodes = [] } = await dynamodbClient
      .scan({ TableName: NODE_REGISTRY_TABLE })
      .promise();

    for (let node of nodes) {
      try {
        const res = await axios.get(`${node.nodeUrl}/federation/export`);
        const { listings, transactions, users } = res.data;

        if (listings) await upsertMany(Listing, listings);
        if (transactions) await upsertMany(Transaction, transactions);
        if (users) await upsertMany(User, users);

        await dynamodbClient
          .update({
            TableName: NODE_REGISTRY_TABLE,
            Key: { nodeUrl: node.nodeUrl },
            UpdateExpression: "set lastSyncAt = :lastSyncAt",
            ExpressionAttributeValues: {
              ":lastSyncAt": new Date().toISOString(),
            },
          })
          .promise();

        console.log(`✔ Synced data from node: ${node.nodeUrl}`);
      } catch (err) {
        console.error(`❌ Federation sync error for node ${node.nodeUrl}:`, err.message);
      }
    const nodes = await getAllNodes();
    for (let node of nodes) {
      //const res = await axios.get(`${node.nodeUrl}/federation/export`);
      //const { listings } = res.data;
      const res = await axios.get(`${node.url}/federation/export`);
      const { listings, transactions, users } = res.data;

      if (listings) await upsertMany(Listing, listings);

      console.log(`✔ Synced data from node: ${node.url}`);
    }
  } catch (err) {
    console.error("❌ Federation sync error:", err.message);
  }
};

// Example scheduled interval (every 30 mins)
setInterval(syncFromPeers, 30 * 60 * 1000);

module.exports = { syncFromPeers };
