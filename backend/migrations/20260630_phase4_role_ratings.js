/**
 * Phase 4 — role-scoped reputations + rating voiding.
 *
 * A user holds a SEPARATE LBTAS reputation per role (market seller, market buyer,
 * agrotourism host/guest, plan producer/backer, …). `rated_role` records the
 * capacity in which the rated user acted, so reputation reads can break out one
 * distribution per role.
 *
 * Voiding: an admin who finds a rating was made in bad faith (e.g. a buyer trying
 * to defraud a seller) can void it so it stops counting, and issue a replacement
 * rating themselves (rater_role = 'admin'). `rater_role` widens from an enum to a
 * varchar to allow that.
 */
exports.up = async function (knex) {
  const hasRatedRole = await knex.schema.hasColumn('lbtas_ratings', 'rated_role');
  if (!hasRatedRole) {
    await knex.schema.alterTable('lbtas_ratings', (t) => {
      t.string('rated_role', 40).notNullable().defaultTo('unknown');
      t.boolean('voided').notNullable().defaultTo(false);
      t.string('voided_by', 36).nullable();
      t.string('voided_reason', 255).nullable();
      t.index(['rated_user_id', 'rated_role'], 'idx_lbtas_rated_role');
    });
  }
  // rater_role was enum('buyer','seller'); allow 'admin' for admin-issued ratings.
  await knex.raw("ALTER TABLE lbtas_ratings MODIFY rater_role VARCHAR(20) NOT NULL");
};

exports.down = async function (knex) {
  const hasRatedRole = await knex.schema.hasColumn('lbtas_ratings', 'rated_role');
  if (hasRatedRole) {
    await knex.schema.alterTable('lbtas_ratings', (t) => {
      t.dropIndex(['rated_user_id', 'rated_role'], 'idx_lbtas_rated_role');
      t.dropColumn('rated_role');
      t.dropColumn('voided');
      t.dropColumn('voided_by');
      t.dropColumn('voided_reason');
    });
  }
};
