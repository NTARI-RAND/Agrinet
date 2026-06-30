/**
 * Phase 3 — LBTAS rating event store (Leveson-Based Trade Assessment Scale, v2).
 *
 * Reputation is a *distribution*, never an average (see the LBTAS spec). So we
 * persist individual rating events and compute distributions on read — not a
 * running tally on `users.reputation_score` (which this phase stops writing to).
 *
 * Each event records: the rated party, the rater, the rater's side (bidirectional),
 * the value (-1..+4), an optional category, the justifying comment (mandatory for
 * -1, enforced at the API boundary), a timestamp, and the triggering transaction.
 *
 * One rating per direction per transaction is enforced by a unique
 * (transaction_id, rater_role) constraint.
 */
exports.up = async function (knex) {
  if (await knex.schema.hasTable('lbtas_ratings')) return;
  await knex.schema.createTable('lbtas_ratings', (t) => {
    t.string('id', 36).primary();
    t.string('transaction_id', 36).notNullable().references('id').inTable('transactions');
    t.string('rated_user_id', 36).notNullable().references('id').inTable('users');
    t.string('rater_user_id', 36).notNullable().references('id').inTable('users');
    t.enu('rater_role', ['buyer', 'seller']).notNullable();
    t.integer('value').notNullable();              // -1..+4, validated at the boundary
    t.string('category', 40).notNullable().defaultTo('overall');
    t.text('comment');                             // required when value = -1 (<=500 words)
    t.timestamp('created_at').defaultTo(knex.fn.now());
    t.unique(['transaction_id', 'rater_role'], 'uq_lbtas_tx_role');
    t.index(['rated_user_id'], 'idx_lbtas_rated');
    t.index(['value'], 'idx_lbtas_value');
  });
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('lbtas_ratings');
};
