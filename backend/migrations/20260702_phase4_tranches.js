/**
 * Phase 4 — progress-payment tranches.
 *
 * A plan may settle in tranches: escrow splits into `tranche_count` parts. The
 * buyer releases intermediate tranches as the producer posts PING progress (giving
 * the producer working capital), and the FINAL tranche stays gated by the buyer's
 * rating. `released_amount` tracks how much has already gone to the seller so the
 * rating (or a dispute refund) only touches what's still held.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('transactions', 'tranche_count'))) {
    await knex.schema.alterTable('transactions', (t) => {
      t.integer('tranche_count').nullable();            // null = not a tranche contract
      t.integer('tranches_released').notNullable().defaultTo(0);
      t.decimal('released_amount', 12, 2).notNullable().defaultTo(0);
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('transactions', 'tranche_count')) {
    await knex.schema.alterTable('transactions', (t) => {
      t.dropColumn('tranche_count');
      t.dropColumn('tranches_released');
      t.dropColumn('released_amount');
    });
  }
};
