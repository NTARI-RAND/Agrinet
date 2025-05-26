const express = require('express');
const router = express.Router();

const Notification = require("../models/notifications");
const { addPingJob } = require('../bull/pingJobs');
const Transaction = require("../models/transaction");

// POST /api/transactions - create a new transaction and send notification
router.post('/transactions', async (req, res) => {
  try {
    // Get transaction data from request body
    const transactionData = req.body;

    // Create a new transaction instance
    const newTransaction = new Transaction(transactionData);

    // Save the new transaction to the database
    await newTransaction.save();

    // Create a notification for the buyer
    await Notification.create({
      userId: newTransaction.buyerId,
      message: `Your transaction ${newTransaction._id} has been initiated.`
    });

    // Add a ping job for this transaction
    addPingJob(newTransaction._id);

    res.status(201).json({ message: 'Transaction created and notification sent.' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
