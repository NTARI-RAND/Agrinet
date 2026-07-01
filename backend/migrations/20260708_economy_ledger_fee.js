/**
 * Economy: net-zero double-entry ledger + platform fee control (JFA §7.2–§7.4).
 *
 * - `ledger_entries` is the append-only source of truth for balances. Every money
 *   movement is posted as a set of signed entries that SUM TO ZERO across the
 *   exchange (buyer/escrow/seller/platform/fiat_gateway). `wallets.balance` is kept
 *   as a derived cache, updated atomically with each posting, and reconcilable
 *   against the ledger (it can no longer silently drift).
 * - `platform_settings` holds the operator's platform fee in basis points, set by an
 *   admin. The fee is applied at settlement and recorded as a visible ledger entry
 *   to the `platform` account (transparent, contestable fee — JFA open problem 7).
 *
 * Backfill: existing wallet balances are opened as ledger entries against a
 * `genesis` account, so the ledger reconciles with balances from day one.
 */

exports.up = async function up(knex) {
  await knex.schema.createTable('ledger_entries', (t) => {
    t.bigIncrements('id').primary();
    t.string('tx_id', 36).nullable();          // the exchange/dialog, when applicable
    t.string('account', 64).notNullable();     // a user_id, or a system account (escrow/platform/fiat_gateway/genesis)
    t.decimal('amount', 14, 2).notNullable();  // signed: + credits the account, - debits it
    t.string('kind', 32).notNullable();        // escrow_fund | escrow_release | platform_fee | refund | tranche | contract_transfer | opening_balance
    t.timestamp('created_at').notNullable().defaultTo(knex.fn.now());
    t.index('account', 'idx_ledger_account');
    t.index('tx_id', 'idx_ledger_tx');
  });

  await knex.schema.createTable('platform_settings', (t) => {
    t.tinyint('id').notNullable().primary().defaultTo(1); // single-row table
    t.integer('fee_bps').notNullable().defaultTo(0);      // platform fee, basis points (100 bps = 1%)
    t.string('updated_by', 36).nullable();
    t.timestamp('updated_at').notNullable().defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
  });

  const seedBps = Math.max(0, Math.min(10000, parseInt(process.env.PLATFORM_FEE_BPS || '0', 10) || 0));
  await knex('platform_settings').insert({ id: 1, fee_bps: seedBps }).onConflict('id').ignore();

  // Backfill: open each existing non-zero wallet balance as a ledger entry, balanced
  // against `genesis`, so balance == SUM(ledger) for every account going forward.
  const wallets = await knex('wallets').select('user_id', 'balance').where('balance', '<>', 0);
  for (const w of wallets) {
    const amt = Number(w.balance);
    await knex('ledger_entries').insert([
      { tx_id: null, account: w.user_id, amount: amt, kind: 'opening_balance' },
      { tx_id: null, account: 'genesis', amount: -amt, kind: 'opening_balance' },
    ]);
  }
};

exports.down = async function down(knex) {
  await knex.schema.dropTableIfExists('platform_settings');
  await knex.schema.dropTableIfExists('ledger_entries');
};
