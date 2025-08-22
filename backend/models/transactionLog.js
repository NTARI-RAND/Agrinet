// For DynamoDB: No schema or model definitions are needed.
// This file provides the table name and a helper for building transaction log items.

const TRANSACTION_LOG_TABLE_NAME = "TransactionLogs";

/**
 * Helper to create a transaction log item for DynamoDB.
 * The table is expected to have `transactionId` as the partition key and
 * `timestamp` as the sort key so that logs can be queried chronologically per transaction.
 *
 * @param {Object} params
 * @param {string} transactionId - Partition key for the log item
 * @param {string} actorId
 * @param {string} action - One of: "ping", "rating", "status_change", "flag", "escrow_release"
 * @param {string} note
 * @param {string} timestamp - ISO string (e.g., new Date().toISOString())
 * @returns {Object}
 */
function createTransactionLogItem({
  transactionId,
  actorId,
  action,
  note,
  timestamp = new Date().toISOString()
}) {
  return {
    transactionId, // Partition key
    timestamp,     // Sort key
    actorId,
    action,
    note
  };
}

module.exports = {
  TRANSACTION_LOG_TABLE_NAME,
  createTransactionLogItem
};
