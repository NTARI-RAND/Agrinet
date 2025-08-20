const DEPOSIT_ACCOUNT_TABLE_NAME = "DepositAccounts";

function createDepositAccountItem({
  userId,
  balance = 0,
  currency = "USD",
  transactionHistory = []
}) {
  return {
    userId, // Partition key for DynamoDB table
    balance,
    currency,
    transactionHistory
  };
}

module.exports = {
  DEPOSIT_ACCOUNT_TABLE_NAME,
  createDepositAccountItem
};
