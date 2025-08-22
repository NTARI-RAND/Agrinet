// DynamoDB helper for transactions
// Provides table name and item builder for use with AWS DynamoDB DocumentClient.

const TRANSACTION_TABLE_NAME = "Transactions";

/**
 * Build a transaction item suitable for DynamoDB.
 * @param {Object} params
 * @param {string} id - Unique transaction id (partition key)
 * @param {string} contractId
 * @param {string} consumerId
 * @param {string} producerId
 * @param {number|null} rating
 * @param {string} status
 * @returns {Object}
 */
function createTransactionItem({
  id,
  contractId,
  consumerId,
  producerId,
  rating = null,
  status = "pending"
}) {
  return {
    id, // Partition key
    contractId,
    consumerId,
    producerId,
    rating,
    status
  };
}

module.exports = {
  TRANSACTION_TABLE_NAME,
  createTransactionItem
};
