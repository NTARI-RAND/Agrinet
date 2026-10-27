const express = require('express');
const router = express.Router();
const docClient = require('../lib/dynamodbClient');
const { LISTING_TABLE_NAME } = require('../models/listing');
const { TRANSACTION_TABLE_NAME } = require('../models/transaction');
const { importFederatedData } = require('../sync/importHelper');
const { collectionPage, scanPage, pageError } = require('../lib/collectionPage');
const exportFields = require('./exportFields');
const { validExportKey } = require('./exportAuth');

// Export route for peer sync
router.get('/export', async (req, res) => {
  // A member JWT is not operator permission to bulk-export application data.
  if (!validExportKey(req)) return res.status(403).json({ error: 'Read-only federation export key required' });
  try {
    const page = collectionPage(req.query, ['federation-export']);
    const result = { listings: [], transactions: [], users: [] };
    const next = {};
    for (const [name, table, allowed, present] of [
      ['listings', LISTING_TABLE_NAME, exportFields.listingFields, exportFields.listing],
      ['transactions', TRANSACTION_TABLE_NAME, exportFields.transactionFields, exportFields.transaction],
    ]) {
      if (page.state && page.state[name] === null) { next[name] = null; continue; }
      const names = Object.fromEntries(allowed.map((field, i) => [`#f${i}`, field]));
      const data = await scanPage(docClient, {
        TableName: table, ProjectionExpression: Object.keys(names).join(', '), ExpressionAttributeNames: names,
      }, page.limit, page.state?.[name]);
      result[name] = data.items.map(present);
      next[name] = data.next;
    }
    page.finish(res, Object.values(next).some(Boolean) ? next : null);
    res.set('X-Federation-Omissions', 'users, dialogNotes, ratings');
    res.json(result);
  } catch (err) {
    pageError(res, err, 'Export failed');
  }
});

// Import route for federation sync
router.post('/import', async (req, res) => {
  try {
    await importFederatedData(req.body);

    res.json({ message: 'Import successful' });
  } catch (err) {
    res.status(500).json({ error: 'Import failed' });
  }
});

module.exports = router;
