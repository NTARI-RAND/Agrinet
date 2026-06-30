/**
 * Phase 5 — Mycelium: an append-only, hash-chained transaction-record ledger.
 *
 * Each entry links to the previous one: hash = sha256(prev_hash + canonical(entry)).
 * Editing or deleting any past entry breaks the chain from that point on, so the
 * record is tamper-evident. `data` is stored as TEXT (verbatim) — not JSON — so the
 * exact bytes that were hashed round-trip for verification (a JSON column would
 * re-order keys and break the hash).
 *
 * Append-only by contract: the app never UPDATEs or DELETEs rows here.
 */
exports.up = async function (knex) {
  if (!(await knex.schema.hasTable('mycelium'))) {
    await knex.schema.createTable('mycelium', (t) => {
      t.bigIncrements('seq').primary();              // chain order
      t.string('id', 36).notNullable().unique();     // entry uuid (part of the hash)
      t.string('event_type', 40).notNullable();
      t.string('transaction_id', 36);                // subject transaction (nullable)
      t.text('data');                                // canonical event facts (verbatim)
      t.string('prev_hash', 64);                     // hex sha256 of the previous entry
      t.string('hash', 64).notNullable();            // sha256(prev_hash + canonical(entry))
      t.timestamp('created_at').defaultTo(knex.fn.now());
      t.index(['transaction_id'], 'idx_myc_tx');
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists('mycelium');
};
