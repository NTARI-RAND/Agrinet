const http = require('../lib/httpClient');
const dynamodbClient = require("../lib/dynamodbClient");
const { NODE_REGISTRY_TABLE_NAME } = require("./models/nodeRegistry");

const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:5000";

const runFederationSync = async () => {
   // Scan all nodes from DynamoDB table
  const { Items: nodes } = await dynamodbClient
    .scan({ TableName: NODE_REGISTRY_TABLE_NAME })
    .promise();
/*
const { getAllNodes, saveNode } = require("./models/nodeRegistry");

const runFederationSync = async () => {
  const nodes = await getAllNodes();
*/
  for (const node of nodes) {
    try {
      // Fetch federation/export data from the node
      const { data } = await http.get(`${node.url}/federation/export`);
      
      // Update lastSyncAt in DynamoDB for this node
      await http.post(`${BACKEND_URL}/import`, data);

      await dynamodbClient
        .update({
          TableName: NODE_REGISTRY_TABLE_NAME,
          Key: { url: node.url },
          UpdateExpression: "set lastSyncAt = :time",
          ExpressionAttributeValues: {
            ":time": new Date().toISOString(),
          },
        })
        .promise();

      //node.lastSyncAt = new Date().toISOString();
      //await saveNode(node);

      console.log(`✅ Synced with ${node.url}`);
    } catch (err) {
      console.error(`❌ Failed to sync with ${node.url}`);
    }
  }
};

// Run every 6 hours
setInterval(runFederationSync, 6 * 60 * 60 * 1000); // 6 hours

module.exports = { runFederationSync };
