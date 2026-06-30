/**
 * Phase 5 — rating-timeout automation.
 *
 * A timeout default rating (P3-013 §4.1) is attributed to a `system` actor (silence
 * read as a completed exchange). `lbtas_ratings.rater_user_id` is FK-bound to users,
 * so we seed a dedicated system user to own those defaults. It is marked by
 * `rater_role = 'system'` and `category = 'timeout'`, so it is always distinguishable
 * from an affirmed party rating.
 */
exports.up = async function (knex) {
  const exists = await knex('users').where({ id: 'system' }).first();
  if (!exists) {
    await knex('users').insert({ id: 'system', email: 'system@agrinet.local', role: 'system' });
  }
};

exports.down = async function (knex) {
  await knex('users').where({ id: 'system' }).del();
};
