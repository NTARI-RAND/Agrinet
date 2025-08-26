const express = require('express');
const router = express.Router();
const { processCommand } = require('../broadcast/commandProcessor');

router.post('/', (req, res) => {
  try {
    const result = processCommand(req.body);
    res.status(200).json(result);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

module.exports = router;
