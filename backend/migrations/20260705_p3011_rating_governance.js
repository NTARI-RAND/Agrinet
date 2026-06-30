/**
 * P3-011 v2 audit fixes (V2 + V3).
 *
 * V2 — harm claims must run both ways: any rated party can contest a rating made
 * against them (not just the buyer via the escrow dispute). Add contest fields.
 *
 * V3 — the justifying narrative (and any PII) must NOT be part of the protocol
 * rating event / the commons. Move it into a separate operator-local table; the
 * protocol event keeps only the level. Reputation reads, the Mycelium ledger, and
 * federation never touch narratives — only a transaction's own parties (and the
 * operator's adjudicator) read them. (Physical relocation to the front end's own
 * store follows when Fruitful gains one; this is the structural separation.)
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasColumn('lbtas_ratings', 'contested'))) {
    await knex.schema.alterTable('lbtas_ratings', (t) => {
      t.boolean('contested').notNullable().defaultTo(false);
      t.string('contested_by', 36).nullable();
      t.string('contest_reason', 500).nullable();
    });
  }

  if (!(await knex.schema.hasTable('rating_narratives'))) {
    await knex.schema.createTable('rating_narratives', (t) => {
      t.string('id', 36).primary();
      t.string('rating_id', 36).notNullable().references('id').inTable('lbtas_ratings');
      t.text('body');                                  // operator-local; never federated
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['rating_id'], 'idx_narr_rating');
    });
  }

  // Move any existing comments into the operator-local table, then drop the column
  // from the protocol event.
  if (await knex.schema.hasColumn('lbtas_ratings', 'comment')) {
    await knex.raw(
      `INSERT INTO rating_narratives (id, rating_id, body)
       SELECT UUID(), id, comment FROM lbtas_ratings WHERE comment IS NOT NULL AND comment <> ''`
    );
    await knex.schema.alterTable('lbtas_ratings', (t) => t.dropColumn('comment'));
  }
};

exports.down = async function (knex) {
  if (!(await knex.schema.hasColumn('lbtas_ratings', 'comment'))) {
    await knex.schema.alterTable('lbtas_ratings', (t) => t.text('comment'));
  }
  await knex.schema.dropTableIfExists('rating_narratives');
  if (await knex.schema.hasColumn('lbtas_ratings', 'contested')) {
    await knex.schema.alterTable('lbtas_ratings', (t) => {
      t.dropColumn('contested');
      t.dropColumn('contested_by');
      t.dropColumn('contest_reason');
    });
  }
};
