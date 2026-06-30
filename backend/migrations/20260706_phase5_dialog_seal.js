/**
 * Phase 5 — Mycelium conformance: dialog-file open→seal model (P3-013).
 *
 * Replaces the per-event ledger with two append-only structures:
 *   mycelium_log     — the intra-dialog chain: every transmission of a dialog, in
 *                      order, each folded into a running head hash (bits chained as
 *                      received). One dialog per transaction (dialog_id = tx id).
 *   mycelium_anchors — the inter-dialog chain: a seal (or post-seal annotation) per
 *                      sealed dialog, chained globally by `n`.
 *
 * `data` is verbatim TEXT (refs only — never PII; the hashed bytes must round-trip).
 * The old per-event `mycelium` table is dropped (superseded; no production data).
 */
exports.up = async function (knex) {
  await knex.schema.dropTableIfExists('mycelium');

  if (!(await knex.schema.hasTable('mycelium_log'))) {
    await knex.schema.createTable('mycelium_log', (t) => {
      t.string('id', 36).primary();
      t.string('dialog_id', 36).notNullable();      // = transaction id
      t.integer('seq').notNullable();               // per-dialog, from 0
      t.string('type', 40).notNullable();
      t.string('actor_id', 36);
      t.string('actor_role', 24);
      t.text('data');                               // refs + structural facts only
      t.string('head_hash', 64).notNullable();      // H(prev_head ‖ canonical(this))
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.unique(['dialog_id', 'seq'], 'uq_myclog_dialog_seq');
      t.index(['dialog_id'], 'idx_myclog_dialog');
    });
  }

  if (!(await knex.schema.hasTable('mycelium_anchors'))) {
    await knex.schema.createTable('mycelium_anchors', (t) => {
      t.bigIncrements('n').primary();               // global chain order
      t.string('id', 36).notNullable().unique();
      t.string('dialog_id', 36).notNullable();
      t.enu('kind', ['seal', 'annotation']).notNullable();
      t.string('file_hash', 64).notNullable();      // dialog head at sealed_seq
      t.integer('sealed_seq').notNullable();
      t.string('prev_hash', 64);                    // previous anchor's hash
      t.string('hash', 64).notNullable();
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['dialog_id'], 'idx_mycanchor_dialog');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('mycelium_anchors');
  await knex.schema.dropTableIfExists('mycelium_log');
};
