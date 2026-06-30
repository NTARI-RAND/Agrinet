/**
 * Phase 5 — operator registration + rotating keys.
 *
 * Operators are the frontend / federation instances that talk to Agrinet (the
 * platform boundary, distinct from user login). Each operator registers a SET of
 * public keys (the whitepaper's rotating 7-key scheme); a transmission is signed by
 * 2 of them. Signatures are Ed25519 now, swappable to a PQ scheme (ML-DSA) later —
 * only `algo` + the stored public keys change, not the protocol shape.
 *
 * Private keys are NEVER stored here — only the operator holds them.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('operators'))) {
    await knex.schema.createTable('operators', (t) => {
      t.string('id', 36).primary();
      t.string('name', 255).notNullable();
      t.enu('status', ['active', 'revoked']).notNullable().defaultTo('active');
      t.timestamp('created_at').defaultTo(knex.fn.now());
    });
  }
  if (!(await knex.schema.hasTable('operator_keys'))) {
    await knex.schema.createTable('operator_keys', (t) => {
      t.string('id', 36).primary();
      t.string('operator_id', 36).notNullable().references('id').inTable('operators');
      t.integer('key_index').notNullable();           // 0..6 in the rotating set
      t.text('public_key').notNullable();             // PEM (SPKI); never the private key
      t.string('algo', 32).notNullable().defaultTo('ed25519');
      t.enu('status', ['active', 'retired']).notNullable().defaultTo('active');
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['operator_id', 'status'], 'idx_opkeys_operator');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('operator_keys');
  await knex.schema.dropTableIfExists('operators');
};
