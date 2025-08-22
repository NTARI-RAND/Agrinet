const docClient = require("../lib/dynamodbClient");
const {
  TRANSACTION_LOG_TABLE_NAME,
  createTransactionLogItem
} = require("../models/transactionLog");

exports.logTransactionEvent = async ({ transactionId, actorId, action, note }) => {
  try {
    const item = createTransactionLogItem({ transactionId, actorId, action, note });
    await docClient
      .put({ TableName: TRANSACTION_LOG_TABLE_NAME, Item: item })
      .promise();
  } catch (err) {
    console.error("Log save error:", err);
  }
};
