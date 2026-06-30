/**
 * Phase 4 — delayed settlement (maturity hold).
 *
 * A plan may settle "at maturity" rather than on the buyer's confirmation. Each
 * contract snapshots a `settle_at` date; the buyer's confirm-to-release (and a
 * seller-initiated release) is blocked until then, so the producer can't be paid
 * before the delivery/harvest date. settle_at NULL = settle on confirmation (the
 * existing behavior).
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('transactions', 'settle_at'))) {
    await knex.schema.alterTable('transactions', (t) => {
      t.datetime('settle_at').nullable();
    });
  }
};

exports.down = async function (knex) {
  if (await knex.schema.hasColumn('transactions', 'settle_at')) {
    await knex.schema.alterTable('transactions', (t) => {
      t.dropColumn('settle_at');
    });
  }
};
