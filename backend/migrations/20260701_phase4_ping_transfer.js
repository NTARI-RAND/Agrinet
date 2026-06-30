/**
 * Phase 4 — PING reports + contract transfer (futures-style).
 *
 * ping_reports: progress updates the SELLER (producer) posts against a contract,
 * keyed by transaction_id — so they belong to the *contract*, not the buyer, and
 * carry over automatically when the contract changes hands.
 *
 * contract_transfers: the ledger of position transfers. A buyer can sell their
 * contract to a new buyer for more or less than they paid (like a commodity
 * future); the producer's escrowed amount is untouched, only buyer_id moves.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('ping_reports'))) {
    await knex.schema.createTable('ping_reports', (t) => {
      t.string('id', 36).primary();
      t.string('transaction_id', 36).notNullable().references('id').inTable('transactions');
      t.string('author_id', 36).notNullable().references('id').inTable('users');
      t.text('note');
      t.json('media'); // array of uploaded file URLs
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['transaction_id'], 'idx_ping_tx');
    });
  }

  if (!(await knex.schema.hasTable('contract_transfers'))) {
    await knex.schema.createTable('contract_transfers', (t) => {
      t.string('id', 36).primary();
      t.string('transaction_id', 36).notNullable().references('id').inTable('transactions');
      t.string('from_user', 36).notNullable().references('id').inTable('users');
      t.string('to_user', 36).notNullable().references('id').inTable('users');
      t.decimal('price', 12, 2).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['transaction_id'], 'idx_transfer_tx');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('ping_reports');
  await knex.schema.dropTableIfExists('contract_transfers');
};
