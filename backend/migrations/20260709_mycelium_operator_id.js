/**
 * Mycelium: scope the log per operator (P3-013 §5). There is no global chain — each
 * operator keeps its own append-only log. Adds `operator_id` to both tables; existing
 * single-backend history adopts this node's operator id (so it becomes that
 * operator's log). Cross-operator non-equivocation is by witnessing (§5.1), which
 * remains intended-not-built.
 */
const OPERATOR_ID = process.env.OPERATOR_ID || 'agrinet';

exports.up = async function up(knex) {
  const hasLogCol = await knex.schema.hasColumn('mycelium_log', 'operator_id');
  if (!hasLogCol) {
    await knex.schema.alterTable('mycelium_log', (t) => {
      t.string('operator_id', 64).notNullable().defaultTo(OPERATOR_ID).after('dialog_id');
    });
  }
  const hasAnchorCol = await knex.schema.hasColumn('mycelium_anchors', 'operator_id');
  if (!hasAnchorCol) {
    await knex.schema.alterTable('mycelium_anchors', (t) => {
      t.string('operator_id', 64).notNullable().defaultTo(OPERATOR_ID).after('dialog_id');
    });
  }
  // Existing rows adopt this node's operator id.
  await knex('mycelium_log').update({ operator_id: OPERATOR_ID });
  await knex('mycelium_anchors').update({ operator_id: OPERATOR_ID });
};

exports.down = async function down(knex) {
  await knex.schema.alterTable('mycelium_log', (t) => t.dropColumn('operator_id'));
  await knex.schema.alterTable('mycelium_anchors', (t) => t.dropColumn('operator_id'));
};
