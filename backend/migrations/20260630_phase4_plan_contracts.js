/**
 * Phase 4 — plan contracting.
 *
 * A contract is just a transaction whose subject is a plan POST rather than a
 * listing. Transactions historically required a `listing_id` (FK -> listings), so
 * we add a nullable `post_id` (FK -> posts) and relax `listing_id` to allow NULL.
 * Every escrow / rating / dispute / settlement path then works unchanged — a
 * contract is a transaction with `post_id` set and `listing_id` null.
 */
exports.up = async function (knex) {
  const hasPostId = await knex.schema.hasColumn('transactions', 'post_id');
  if (!hasPostId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.string('post_id', 36).nullable().references('id').inTable('posts');
      t.index(['post_id'], 'idx_tx_post');
    });
  }
  // Contracts reference a post, not a listing -> listing_id must allow NULL.
  await knex.raw("ALTER TABLE transactions MODIFY listing_id VARCHAR(36) NULL");
};

exports.down = async function (knex) {
  const hasPostId = await knex.schema.hasColumn('transactions', 'post_id');
  if (hasPostId) {
    await knex.schema.alterTable('transactions', (t) => {
      t.dropForeign(['post_id']);
      t.dropIndex(['post_id'], 'idx_tx_post');
      t.dropColumn('post_id');
    });
  }
};
