const docClient = require('../lib/dynamodbClient');
const { INVENTORY_TABLE_NAME, createInventoryItem } = require('../models/inventory');
const axios = require('axios');

// Fetch all inventory items
exports.getInventory = async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: INVENTORY_TABLE_NAME }).promise();
    res.json(data.Items || []);
  } catch (err) {
    res.status(500).json({ error: 'Error fetching inventory' });
  }
};

// Create a new inventory item
exports.createInventory = async (req, res) => {
  try {
    const item = createInventoryItem(req.body);
    await docClient.put({ TableName: INVENTORY_TABLE_NAME, Item: item }).promise();
    res.status(201).json(item);
  } catch (err) {
    res.status(500).json({ error: 'Error creating inventory item' });
  }
};

// Update stock, batch, or lot information
exports.updateStock = async (req, res) => {
  try {
    const { id } = req.params;
    const { stock, batch, lot } = req.body;
    const params = {
      TableName: INVENTORY_TABLE_NAME,
      Key: { id },
      UpdateExpression: 'set stock = :s, updatedAt = :u',
      ExpressionAttributeValues: {
        ':s': stock,
        ':u': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    if (batch !== undefined) {
      params.UpdateExpression += ', batch = :b';
      params.ExpressionAttributeValues[':b'] = batch;
    }
    if (lot !== undefined) {
      params.UpdateExpression += ', lot = :l';
      params.ExpressionAttributeValues[':l'] = lot;
    }
    const { Attributes } = await docClient.update(params).promise();
    res.json(Attributes);
  } catch (err) {
    res.status(500).json({ error: 'Error updating stock' });
  }
};

// Update price information
exports.updatePrice = async (req, res) => {
  try {
    const { id } = req.params;
    const { price } = req.body;
    const params = {
      TableName: INVENTORY_TABLE_NAME,
      Key: { id },
      UpdateExpression: 'set price = :p, updatedAt = :u',
      ExpressionAttributeValues: {
        ':p': price,
        ':u': new Date().toISOString()
      },
      ReturnValues: 'ALL_NEW'
    };
    const { Attributes } = await docClient.update(params).promise();
    res.json(Attributes);
  } catch (err) {
    res.status(500).json({ error: 'Error updating price' });
  }
};

// Sync with an external inventory system
exports.syncExternal = async (req, res) => {
  try {
    const url = process.env.EXTERNAL_INVENTORY_URL;
    if (!url) {
      return res.status(500).json({ error: 'EXTERNAL_INVENTORY_URL not configured' });
    }
    const response = await axios.get(url);
    const items = Array.isArray(response.data) ? response.data : [];
    let imported = 0;
    for (const ext of items) {
      const item = createInventoryItem(ext);
      await docClient.put({ TableName: INVENTORY_TABLE_NAME, Item: item }).promise();
      imported++;
    }
    res.json({ imported });
  } catch (err) {
    res.status(500).json({ error: 'Error syncing external inventory' });
  }
};
