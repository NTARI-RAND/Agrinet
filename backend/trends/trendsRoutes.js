const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { USER_TABLE_NAME } = require('../models/user');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { generateAIInsight } = require('../utils/aiTrendHelper');

// 1. Top Rated Producers
router.get('/top-rated', async (req, res) => {
  try {
    const { limit = 5, region } = req.query;
    const params = {
      TableName: USER_TABLE_NAME,
      FilterExpression: '#role = :producer',
      ExpressionAttributeNames: { '#role': 'role' },
      ExpressionAttributeValues: { ':producer': 'producer' }
    };
    if (region) {
      params.FilterExpression += ' AND contains(#loc, :r)';
      params.ExpressionAttributeNames['#loc'] = 'location';
      params.ExpressionAttributeValues[':r'] = region;
    }
    const data = await docClient.scan(params).promise();
    const sorted = data.Items.sort((a, b) => b.reputationScore - a.reputationScore).slice(0, parseInt(limit));
    res.json(sorted);
  } catch (err) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

// 2. Market Volume by Region
router.get('/market-volume', async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: LISTING_TABLE_NAME }).promise();
    const counts = {};
    for (const item of data.Items) {
      counts[item.location] = (counts[item.location] || 0) + 1;
    }
    const result = Object.entries(counts)
      .map(([location, count]) => ({ location, count }))
      .sort((a, b) => b.count - a.count);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

// 3. Listing Trends Over Time
router.get('/listing-trends', async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: LISTING_TABLE_NAME }).promise();
    const counts = {};
    for (const item of data.Items) {
      const date = item.createdAt ? item.createdAt.substring(0, 10) : 'unknown';
      counts[date] = (counts[date] || 0) + 1;
    }
    const result = Object.entries(counts)
      .sort((a, b) => a[0].localeCompare(b[0]))
      .map(([date, count]) => ({ date, count }));
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

// 4. Ping Responsiveness
router.get('/ping-response', async (req, res) => {
  try {
    const data = await docClient.scan({ TableName: TRANSACTION_TABLE_NAME }).promise();
    const grouped = {};
    for (const t of data.Items) {
      if (!t.sellerId) continue;
      const lastPing = t.lastPing ? new Date(t.lastPing) : new Date();
      const days = (Date.now() - lastPing.getTime()) / 86400000;
      grouped[t.sellerId] = grouped[t.sellerId] || [];
      grouped[t.sellerId].push(days);
    }
    const result = Object.entries(grouped)
      .map(([sellerId, arr]) => ({
        sellerId,
        avgDays: arr.reduce((sum, v) => sum + v, 0) / arr.length
      }))
      .sort((a, b) => a.avgDays - b.avgDays);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: 'Aggregation failed' });
  }
});

// AI Trend Insight Trigger
router.get('/ai/insight', async (req, res) => {
  try {
    const { region } = req.query;
    const insights = await generateAIInsight(region);
    res.json({ insights });
  } catch (err) {
    res.status(500).json({ error: 'AI trend generation failed' });
  }
});

module.exports = router;
