const docClient = require('../lib/dynamodbClient');
const { DEPOSIT_ACCOUNT_TABLE_NAME } = require('../models/depositAccount');

// Example adapter for manually verifying wallet transfers
exports.manualWalletCredit = async (req, res) => {
  try {
    const { walletAddress, userId, amount, txHash } = req.body;

    if (!walletAddress || !userId || !amount || !txHash) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const numericAmount = parseFloat(amount);
    const params = {
      TableName: DEPOSIT_ACCOUNT_TABLE_NAME,
      Key: { userId },
      UpdateExpression:
        'SET balance = if_not_exists(balance, :zero) + :amount, transactionHistory = list_append(if_not_exists(transactionHistory, :empty_list), :entry)',
      ExpressionAttributeValues: {
        ':amount': numericAmount,
        ':zero': 0,
        ':entry': [
          {
            type: 'fund',
            amount: numericAmount,
            date: new Date().toISOString(),
            note: `Wallet Transfer: ${walletAddress} - TxHash: ${txHash}`
          }
        ],
        ':empty_list': []
      },
      ReturnValues: 'UPDATED_NEW'
    };

    const result = await docClient.update(params).promise();

    res.json({ message: 'Wallet deposit recorded', newBalance: result.Attributes.balance });
  } catch (error) {
    res.status(500).json({ error: 'Wallet adapter error' });
  }
};
