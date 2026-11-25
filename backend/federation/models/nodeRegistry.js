const docClient = require("../../lib/dynamodbClient");
const { applyNodeTemplate } = require("./nodeTemplate");
const NODE_REGISTRY_TABLE_NAME = "NodeRegistry";

/**
 * Helper to create a node registry item for DynamoDB.
 * @param {Object} params
 * @param {string} nodeId - Unique identifier for the node
 * @param {string} url - Unique URL for the node (can be used as partition key)
 * @param {string} region
 * @param {string} contact
 * @param {string|null} lastSyncAt - ISO string or null
 * @param {Object} production - Production capabilities and related data
 * @param {Object} services - Services like educational, social media, financial, marketing, and messaging
 * @param {Object} reputation - Reputation details such as Leveson scale rating
 * @param {Array<string>} interoperability - Compatible protocols or node URLs
 * @param {Object} support - Support functions like composting, environmental services, labor, and collective management
 * @returns {Object}
 */
function createNodeRegistryItem({
  nodeId,
  url,
  region,
  contact,
  lastSyncAt = null,
  production = {},
  services = {},
  reputation = {},
  interoperability = [],
  support = {},
}) {
  const node = {
    nodeId,
    url,        // Partition key for DynamoDB table
    region,
    contact,
    lastSyncAt, // Should be an ISO string or null
    production,
    services,
    reputation,
    interoperability,
    support,
  };

  // Ensure all expected nested fields are present using recursive template
  return applyNodeTemplate(node);
}

module.exports = {
  NODE_REGISTRY_TABLE_NAME,
  createNodeRegistryItem,
  getAllNodes,
  saveNode,
};

/**
 * Scan the NodeRegistry table for all nodes.
 * @returns {Promise<Array<Object>>}
 */
async function getAllNodes() {
  const data = await docClient.scan({ TableName: NODE_REGISTRY_TABLE_NAME }).promise();
  return data.Items || [];
}

/**
 * Persist a node item back to DynamoDB.
 * @param {Object} node
 * @returns {Promise<void>}
 */
async function saveNode(node) {
  await docClient.put({ TableName: NODE_REGISTRY_TABLE_NAME, Item: node }).promise();
}
