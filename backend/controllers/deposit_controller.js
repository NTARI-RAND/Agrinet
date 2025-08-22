const docClient = require('../lib/dynamodbClient');
const {
  DEPOSIT_ACCOUNT_TABLE_NAME,
  createDepositAccountItem
} = require('../models/depositAccount');

// Create or return a user's deposit account
exports.getOrCreateAccount = async (req, res) => {
  try {
    const userId = req.user.id; // Assumes auth middleware adds user
    const params = {
      TableName: DEPOSIT_ACCOUNT_TABLE_NAME,
      Key: { userId }
    };
    const { Item } = await docClient.get(params).promise();
    if (Item) return res.json(Item);

    const newAccount = createDepositAccountItem({ userId });
    await docClient.put({ TableName: DEPOSIT_ACCOUNT_TABLE_NAME, Item: newAccount }).promise();
    res.json(newAccount);
  } catch (error) {
    res.status(500).json({ error: 'Error fetching deposit account' });
  }
};

// Fund account
exports.fundAccount = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const userId = req.user.id;
    const getRes = await docClient
      .get({ TableName: DEPOSIT_ACCOUNT_TABLE_NAME, Key: { userId } })
      .promise();
    if (!getRes.Item) return res.status(404).json({ error: 'Account not found' });

    const updateParams = {
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
            note
          }
        ],
        ':empty_list': []
      },

      ConditionExpression: 'attribute_exists(userId)',

      ReturnValues: 'UPDATED_NEW'
    };

    const result = await docClient.update(updateParams).promise();
    res.json({ message: 'Account funded', newBalance: result.Attributes.balance });
  } catch (error) {
    res.status(500).json({ error: 'Error funding account' });
  }
};

// Withdraw from account
exports.withdrawAccount = async (req, res) => {
  try {
    const { amount, note } = req.body;
    const numericAmount = parseFloat(amount);
    if (!numericAmount || numericAmount <= 0) {
      return res.status(400).json({ error: 'Invalid amount' });
    }

    const userId = req.user.id;
    const { Item } = await docClient
      .get({ TableName: DEPOSIT_ACCOUNT_TABLE_NAME, Key: { userId } })
      .promise();
    if (!Item) return res.status(404).json({ error: 'Account not found' });
    if ((Item.balance || 0) < numericAmount) {
      return res.status(400).json({ error: 'Insufficient funds' });
    }

    const updateParams = {
      TableName: DEPOSIT_ACCOUNT_TABLE_NAME,
      Key: { userId },
      UpdateExpression:
        'SET balance = balance - :amount, transactionHistory = list_append(if_not_exists(transactionHistory, :empty_list), :entry)',
      ConditionExpression: 'attribute_exists(userId) AND balance >= :amount',
      ExpressionAttributeValues: {
      ConditionExpression: 'attribute_exists(userId) AND if_not_exists(balance, :zero) >= :amount',
      ExpressionAttributeValues: {
        ':amount': numericAmount,
        ':zero': 0,
        ':amount': numericAmount,
        ':entry': [
          {
            type: 'withdraw',
            amount: numericAmount,
            date: new Date().toISOString(),
            note
          }
        ],
        ':empty_list': []
      },
      ReturnValues: 'UPDATED_NEW'
    };

    const result = await docClient.update(updateParams).promise();
    res.json({ message: 'Withdrawal successful', newBalance: result.Attributes.balance });
  } catch (error) {
    if (error.code === 'ConditionalCheckFailedException') {
      return res.status(400).json({ error: 'Insufficient funds' });
    }
    res.status(500).json({ error: 'Error withdrawing from account' });
  }
};

// Get transaction history
exports.getTransactionHistory = async (req, res) => {
  try {
    const userId = req.user.id;
    const { Item } = await docClient
      .get({ TableName: DEPOSIT_ACCOUNT_TABLE_NAME, Key: { userId } })
      .promise();
    if (!Item) return res.status(404).json({ error: 'Account not found' });

    res.json(Item.transactionHistory || []);
  } catch (error) {
    res.status(500).json({ error: 'Error retrieving transaction history' });
  }
};
