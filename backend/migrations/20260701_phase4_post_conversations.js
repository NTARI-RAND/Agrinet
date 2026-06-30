/**
 * Phase 4 — post-scoped messaging.
 *
 * Every conversation is anchored to a POST (of any type) — negotiation happens in
 * the context of a post, never as a free-floating DM. Conversations historically
 * required a listing_id (FK -> listings); we add a nullable post_id (FK -> posts)
 * and relax listing_id, mirroring the transactions change.
 */
exports.up = async function (knex) {
  const hasPostId = await knex.schema.hasColumn('conversations', 'post_id');
  if (!hasPostId) {
    await knex.schema.alterTable('conversations', (t) => {
      t.string('post_id', 36).nullable().references('id').inTable('posts');
      t.index(['post_id'], 'idx_conv_post');
    });
  }
  await knex.raw("ALTER TABLE conversations MODIFY listing_id VARCHAR(36) NULL");
};

exports.down = async function (knex) {
  const hasPostId = await knex.schema.hasColumn('conversations', 'post_id');
  if (hasPostId) {
    await knex.schema.alterTable('conversations', (t) => {
      t.dropForeign(['post_id']);
      t.dropIndex(['post_id'], 'idx_conv_post');
      t.dropColumn('post_id');
    });
  }
};
