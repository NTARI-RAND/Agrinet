const Notification = require("../models/Notification");
const { addPingJob } = require('../bull/pingJobs');

await Notification.create({
  userId: transaction.buyerId,
  message: `Your transaction ${transaction._id} has been initiated.`
});

await newTransaction.save();
addPingJob(newTransaction._id);
