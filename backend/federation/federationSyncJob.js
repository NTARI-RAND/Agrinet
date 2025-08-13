const axios = require("axios");
const docClient = require('../lib/dynamodbClient');
const NODE_REGISTRY_TABLE = 'NodeRegistry'; // Update if your table name differs

const runFederationSync = async () => {
  try {
    // Scan all nodes from DynamoDB
    const params = {
      TableName: NODE_REGISTRY_TABLE
    };
    const result = await docClient.scan(params).promise();
    const nodes = result.Items || [];

    for (const node of nodes) {
      try {
        const { data } = await axios.get(`${node.url}/export`);
        await axios.post("http://localhost:5000/import", data);

        // Update lastSyncAt in DynamoDB
        const updateParams = {
          TableName: NODE_REGISTRY_TABLE,
          Key: { id: node.id }, // assumes 'id' is the partition key
          UpdateExpression: 'set lastSyncAt = :lsa',
          ExpressionAttributeValues: {
            ':lsa': new Date().toISOString()
          }
        };
        await docClient.update(updateParams).promise();

        console.log(`✅ Synced with ${node.url}`);
      } catch (err) {
        console.error(`❌ Failed to sync with ${node.url}`);
      }
    }
  } catch (err) {
    console.error('❌ Federation sync failed:', err);
  }
};

// Run every 6 hours
setInterval(runFederationSync, 6 * 60 * 60 * 1000); // 6 hours

module.exports = runFederationSync;
