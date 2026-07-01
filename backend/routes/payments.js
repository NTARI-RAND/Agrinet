const express = require("express");
const { authenticateToken } = require("../middleware/authMiddleware");
const { strictWriteLimiter, userRateLimiter } = require("../middlewares/rateLimiters");
const settingsRepository = require("../repositories/settingsRepository");

const router = express.Router();

// Retired (JFA §7.3): the in-network unit is not purchasable — there is no general
// wallet top-up. Payments fund a specific transaction's escrow via the transaction
// payment flow (createPaymentForTransaction); a generic fiat deposit would make the
// unit purchasable (deposit-taking), which the architecture forbids.
router.post("/pix/create", authenticateToken, userRateLimiter, strictWriteLimiter, (req, res) => {
  res.status(410).json({
    error: "Wallet top-up is retired. Pay for a specific transaction's escrow instead.",
    code: "PURCHASABILITY_RETIRED",
  });
});

// Public transparency: the current platform fee (JFA §7.4, open problem 7 — fees are
// transparent and contestable). The fee also appears as a visible ledger entry on
// every settlement.
router.get("/fee", async (_req, res) => {
  const bps = await settingsRepository.getFeeBps();
  res.json({ fee_bps: bps, fee_percent: bps / 100 });
});

module.exports = router;
