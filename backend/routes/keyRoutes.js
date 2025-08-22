const express = require("express");
const { issueKey, validateKey } = require("../controllers/key_controller");

const router = express.Router();

// Route to issue a new key
router.post("/issue-key", issueKey);

// Route to validate an existing key
router.post("/validate-key", validateKey);

module.exports = router;

