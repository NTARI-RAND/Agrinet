// For DynamoDB: No schema or model definitions are needed.
// This file provides the table name and a helper for building transaction log items.

const TRANSACTION_LOG_TABLE_NAME = "TransactionLogs";

/**
 * Helper to create a transaction log item for DynamoDB.
 * @param {Object} params
 * @param {string} id - Unique ID for the log (partition key)
 * @param {string} transactionId
 * @param {string} actorId
 * @param {string} action - One of: "ping", "rating", "status_change", "flag", "escrow_release"
 * @param {string} note
 * @param {string} timestamp - ISO string (e.g., new Date().toISOString())
 * @returns {Object}
 */
function createTransactionLogItem({
  id,
  transactionId,
  actorId,
  action,
  note,
  timestamp = new Date().toISOString()
}) {
  return {
    id,
    transactionId,
    actorId,
    action,
    note,
    timestamp
  };
}

module.exports = {
  TRANSACTION_LOG_TABLE_NAME,
  createTransactionLogItem
};
