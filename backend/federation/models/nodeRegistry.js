// DynamoDB: No schema or model definitions needed.
// This file provides the table name and a helper for building node registry items for DynamoDB.

const NODE_REGISTRY_TABLE_NAME = "NodeRegistry";

/**
 * Helper to create a node registry item for DynamoDB.
 * @param {Object} params
 * @param {string} url - Unique URL for the node (can be used as partition key)
 * @param {string} region
 * @param {string} contact
 * @param {string|null} lastSyncAt - ISO string or null
 * @param {Object} production
 * @param {Object} services
 * @param {number} reputation
 * @param {Array<string>} interoperability
 * @param {Object} support
 * @returns {Object}
 */
function createNodeRegistryItem({
  url,
  region,
  contact,
  lastSyncAt = null,
  production = {},
  services = {},
  reputation = null,
  interoperability = [],
  support = {}
}) {
  return {
    url,        // Partition key for DynamoDB table
    region,
    contact,
    lastSyncAt, // Should be an ISO string or null
    production,
    services,
    reputation,
    interoperability,
    support
  };
}

module.exports = {
  NODE_REGISTRY_TABLE_NAME,
  createNodeRegistryItem
};
