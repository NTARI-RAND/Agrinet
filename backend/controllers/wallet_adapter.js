const DepositAccount = require("../models/depositAccount");

// Example adapter for manually verifying wallet transfers
exports.manualWalletCredit = async (req, res) => {
  try {
    const { walletAddress, userId, amount, txHash } = req.body;

    if (!walletAddress || !userId || !amount || !txHash) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    let account = await DepositAccount.findOne({ userId });
    if (!account) {
      account = new DepositAccount({ userId });
    }

    account.balance += parseFloat(amount);
    account.transactionHistory.push({
      type: "fund",
      amount,
      note: `Wallet Transfer: ${walletAddress} - TxHash: ${txHash}`
    });

    await account.save();

    res.json({ message: "Wallet deposit recorded", newBalance: account.balance });
  } catch (error) {
    res.status(500).json({ error: "Wallet adapter error" });
  }
};
