/**
 * Platform settings — currently the operator's platform fee (JFA §7.4, open
 * problem 7: fees must be transparent and contestable). Stored in basis points
 * (100 bps = 1%) in a single-row table.
 */
const pool = require('../lib/db');

const MAX_BPS = 10000; // 100% — a validity bound, not a policy recommendation

async function getFeeBps(conn = pool) {
  const [[row]] = await conn.query('SELECT fee_bps FROM platform_settings WHERE id = 1');
  return row ? Number(row.fee_bps) : 0;
}

async function setFeeBps(bps, adminId, conn = pool) {
  const n = Math.round(Number(bps));
  if (!Number.isFinite(n) || n < 0 || n > MAX_BPS) {
    const err = new Error(`fee_bps must be an integer between 0 and ${MAX_BPS}`);
    err.statusCode = 400;
    throw err;
  }
  await conn.query(
    'UPDATE platform_settings SET fee_bps = ?, updated_by = ? WHERE id = 1',
    [n, adminId || null]
  );
  return n;
}

// The fee owed on a settled amount, rounded to cents. Never exceeds the amount.
function feeFor(amount, bps) {
  const fee = (Number(amount) * Number(bps)) / 10000;
  const rounded = Math.round((fee + Number.EPSILON) * 100) / 100;
  return Math.min(rounded, Number(amount));
}

module.exports = { getFeeBps, setFeeBps, feeFor, MAX_BPS };
