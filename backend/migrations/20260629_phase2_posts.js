/**
 * Phase 2 — unified `posts` table (whitepaper §4.5.3 post taxonomy).
 *
 * One `post_type` discriminator + indexed common columns (for the geolocation
 * "General Broadcast" filter) + a JSON `payload` for type-specific fields, mirroring
 * the whitepaper's own JSON-payload approach.
 *
 * Compatibility shim: existing `listings` rows are copied in as `direct_market`
 * using the SAME id, so transactions that reference a listing id still resolve to
 * a post. `listings` is left intact for backward-compatible reads.
 */
exports.up = async function (knex) {
  const hasPosts = await knex.schema.hasTable('posts');
  if (!hasPosts) {
    await knex.schema.createTable('posts', (t) => {
      t.string('id', 36).primary();
      t.string('user_id', 36).notNullable().references('id').inTable('users');
      t.string('post_type', 32).notNullable();
      t.string('title', 255).notNullable();
      t.text('description');
      t.string('category', 64);                 // top-level category (meaning is type-specific)
      t.string('unit', 32);
      t.decimal('price', 12, 2);
      t.decimal('quantity_available', 14, 2);
      t.string('city', 100);
      t.string('state', 8);
      t.decimal('latitude', 10, 7);
      t.decimal('longitude', 10, 7);
      t.string('location', 255);
      t.json('media');                          // array of URLs
      t.text('terms');
      t.string('status', 20).notNullable().defaultTo('active');
      t.string('moderation_status', 20).defaultTo('approved');
      t.string('origin_node', 255);
      t.json('payload');                        // type-specific fields
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.timestamp('updated_at').defaultTo(knex.raw('CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'));
      t.index(['post_type', 'status'], 'idx_posts_type_status');
      t.index(['latitude', 'longitude'], 'idx_posts_geo');
      t.index(['category'], 'idx_posts_category');
      t.index(['city', 'state'], 'idx_posts_city_state');
      t.index(['user_id'], 'idx_posts_user');
    });
  }

  // Shim: copy listings → posts as direct_market (same id), idempotent.
  if (await knex.schema.hasTable('listings')) {
    await knex.raw(`
      INSERT INTO posts
        (id, user_id, post_type, title, description, category, unit, price,
         quantity_available, city, state, latitude, longitude, location,
         status, moderation_status, origin_node, created_at)
      SELECT
        l.id, l.user_id, 'direct_market', l.title, l.description, l.category, l.unit, l.price,
        l.quantity_available, l.city, l.state, l.latitude, l.longitude, l.location,
        l.status, l.moderation_status, l.origin_node, l.created_at
      FROM listings l
      WHERE NOT EXISTS (SELECT 1 FROM posts p WHERE p.id = l.id)
    `);
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('posts');
};
