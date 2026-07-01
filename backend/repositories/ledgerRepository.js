/**
 * Ledger repository — the net-zero, append-only source of truth for balances
 * (JFA §7.2). Every money movement is a set of signed entries that SUM TO ZERO
 * across the exchange; `wallets.balance` is a derived cache updated atomically here.
 *
 * There is no update and no delete: corrections are new balancing postings.
 */
const pool = require('../lib/db');

// System (non-wallet) accounts. These hold value in the ledger but have no wallet
// row; their balances are always derived from the ledger, never cached.
const ACCOUNTS = {
  ESCROW: 'escrow',            // funds held for an in-flight exchange
  PLATFORM: 'platform',        // platform-fee income (transparent, on the record)
  FIAT_GATEWAY: 'fiat_gateway',// the fiat boundary (Stripe on-ramp)
  GENESIS: 'genesis',          // opening-balance counter-account
};
const SYSTEM = new Set(Object.values(ACCOUNTS));

const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;

/**
 * Post a balanced set of entries. Requires an existing connection (the caller owns
 * the transaction and any row locks). `entries`: [{ account, amount }] with signed
 * amounts. Throws unless the entries sum to zero.
 *
 * opts.checkFunds: assert each real-wallet account being debited has sufficient
 * balance (FOR UPDATE) before posting — used for buyer-funded movements.
 */
async function post(connection, { txId = null, kind, entries }, opts = {}) {
  if (!connection) throw new Error('ledger.post requires a db connection');
  if (!kind) throw new Error('ledger.post requires a kind');
  if (!Array.isArray(entries) || entries.length < 2) throw new Error('ledger.post requires >= 2 entries');

  const sum = round2(entries.reduce((a, e) => a + Number(e.amount), 0));
  if (Math.abs(sum) >= 0.005) {
    throw new Error(`ledger.post is not net-zero (kind=${kind}, sum=${sum})`);
  }

  if (opts.checkFunds) {
    for (const e of entries) {
      const amt = Number(e.amount);
      if (amt < 0 && !SYSTEM.has(e.account)) {
        const [rows] = await connection.query('SELECT balance FROM wallets WHERE user_id = ? FOR UPDATE', [e.account]);
        if (!rows.length) throw new Error('Wallet not found');
        if (Number(rows[0].balance) < -amt) {
          const err = new Error('Insufficient balance');
          err.statusCode = 409;
          throw err;
        }
      }
    }
  }

  for (const e of entries) {
    const amt = round2(e.amount);
    await connection.query(
      'INSERT INTO ledger_entries (tx_id, account, amount, kind) VALUES (?, ?, ?, ?)',
      [txId, e.account, amt, kind]
    );
    // Update the derived wallet cache for real users; system accounts derive on read.
    if (!SYSTEM.has(e.account)) {
      await connection.query('UPDATE wallets SET balance = balance + ? WHERE user_id = ?', [amt, e.account]);
    }
  }
  return { kind, txId, entries: entries.map((e) => ({ account: e.account, amount: round2(e.amount) })) };
}

// Ledger balance of any account (system or user). Source of truth.
async function balanceOf(account, conn = pool) {
  const [[r]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS bal FROM ledger_entries WHERE account = ?', [account]);
  return Number(r.bal);
}

// Reconcile a user's cached wallet balance against the ledger. drift should be 0.
async function reconcile(userId, conn = pool) {
  const [[w]] = await conn.query('SELECT balance FROM wallets WHERE user_id = ?', [userId]);
  const ledger = await balanceOf(userId, conn);
  const wallet = w ? Number(w.balance) : 0;
  return { userId, wallet, ledger, drift: round2(wallet - ledger) };
}

// Global invariant: the whole ledger sums to zero (nothing is created or destroyed).
async function totalOutstanding(conn = pool) {
  const [[r]] = await conn.query('SELECT COALESCE(SUM(amount), 0) AS s FROM ledger_entries');
  return round2(r.s);
}

module.exports = { post, balanceOf, reconcile, totalOutstanding, ACCOUNTS, round2 };
