const TransactionLog = require("../models/transactionLog");

exports.logTransactionEvent = async ({ transactionId, actorId, action, note }) => {
  try {
    const entry = new TransactionLog({ transactionId, actorId, action, note });
    await entry.save();
  } catch (err) {
    console.error("Log save error:", err);
  }
};
