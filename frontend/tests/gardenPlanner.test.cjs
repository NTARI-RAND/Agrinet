const { test } = require('node:test');
const assert = require('node:assert/strict');
const {
  createPlan, analyzePlan, resizePlan, previewResize, plantSquare, serializePlan, parsePlan, saveLocalPlan, loadLocalPlan,
} = require('../lib/gardenPlanner');

test('counts plants using existing spacing and estimates harvest across a leap day', () => {
  const plan = { version: 1, startDate: '2028-02-01', layout: [['tomato', 'basil'], ['lettuce', null]] };
  const result = analyzePlan(plan);
  assert.equal(result.area, 4);
  assert.equal(result.occupiedSquares, 3);
  assert.equal(result.totalPlants, 6);
  assert.deepEqual(result.crops, [
    { crop: 'lettuce', squares: 1, plants: 4, harvestDate: '2028-03-27' },
    { crop: 'basil', squares: 1, plants: 1, harvestDate: '2028-04-01' },
    { crop: 'tomato', squares: 1, plants: 1, harvestDate: '2028-04-11' },
  ]);
  assert.deepEqual(result.conflicts, []);
});

test('reports each incompatible adjacent pair once, without treating diagonals as neighbors', () => {
  const result = analyzePlan({ version: 1, startDate: '2026-03-01', layout: [['tomato', 'carrot'], ['basil', 'lettuce']] });
  assert.deepEqual(result.conflicts, [{ first: [0, 0], second: [0, 1], crops: ['tomato', 'carrot'] }, { first: [1, 0], second: [1, 1], crops: ['basil', 'lettuce'] }]);
});

test('an empty bed has zero plants and no invented crop estimates', () => {
  const result = analyzePlan(createPlan(3, 4, '2026-03-01'));
  assert.equal(result.area, 12);
  assert.equal(result.totalPlants, 0);
  assert.equal(result.occupiedSquares, 0);
  assert.deepEqual(result.crops, []);
});

test('planting and erasing update only the target square without mutating the original', () => {
  const original = createPlan(2, 2, '2026-03-01');
  const planted = plantSquare(original, 0, 1, 'carrot');
  assert.deepEqual(planted.layout, [[null, 'carrot'], [null, null]]);
  assert.equal(analyzePlan(planted).totalPlants, 16);
  assert.equal(original.layout[0][1], null);
  assert.equal(plantSquare(planted, 0, 1, null).layout[0][1], null);
  assert.throws(() => plantSquare(original, 2, 0, 'basil'), /square/i);
  assert.throws(() => plantSquare(original, 0, 0, 'potato'), /crop/i);
});

test('resizing preserves overlapping squares and fills new squares without shared rows', () => {
  const plan = { version: 1, startDate: '2026-03-01', layout: [['tomato', null], [null, 'basil']] };
  const grown = resizePlan(plan, 3, 3);
  assert.deepEqual(grown.layout, [['tomato', null, null], [null, 'basil', null], [null, null, null]]);
  grown.layout[2][0] = 'lettuce';
  assert.equal(grown.layout[0][0], 'tomato');
  assert.deepEqual(resizePlan(plan, 1, 1).layout, [['tomato']]);
  assert.equal(plan.layout[1][1], 'basil');
});

test('previewing a smaller bed reports planted squares that would be removed without changing the plan', () => {
  const plan = { version: 1, startDate: '2026-03-01', layout: [['tomato', 'basil'], ['lettuce', null]] };
  const preview = previewResize(plan, 1, 1);
  assert.equal(preview.removedSquares, 2);
  assert.deepEqual(preview.plan.layout, [['tomato']]);
  assert.deepEqual(plan.layout, [['tomato', 'basil'], ['lettuce', null]]);
  assert.equal(previewResize(plan, 3, 3).removedSquares, 0);
});

test('export and import preserve an editable plan, excluding unrelated fields', () => {
  const plan = { version: 1, startDate: '2026-03-01', layout: [['basil', 'tomato']], privateNote: 'must not export' };
  const serialized = serializePlan(plan);
  assert.deepEqual(JSON.parse(serialized), { version: 1, startDate: '2026-03-01', layout: [['basil', 'tomato']] });
  assert.deepEqual(parsePlan(serialized), { version: 1, startDate: '2026-03-01', layout: [['basil', 'tomato']] });
  assert.equal(analyzePlan(parsePlan(serialized)).totalPlants, 2);
});

test('rejects malformed, oversized, unsupported and nonrectangular imported plans', () => {
  for (const invalid of [
    'not JSON', ' '.repeat(33000), 'null',
    JSON.stringify({ version: 2, startDate: '2026-03-01', layout: [[null]] }),
    JSON.stringify({ version: 1, startDate: '2026-02-30', layout: [[null]] }),
    JSON.stringify({ version: 1, startDate: '2026-03-01T00:00:00Z', layout: [[null]] }),
    JSON.stringify({ version: 1, startDate: '2026-03-01', layout: [['potato']] }),
    JSON.stringify({ version: 1, startDate: '2026-03-01', layout: [[null], [null, null]] }),
    JSON.stringify({ version: 1, startDate: '2026-03-01', layout: [] }),
  ]) assert.throws(() => parsePlan(invalid), /plan|date|crop|bed/i);
  for (const size of [0, -1, 1.5, 9, NaN, '4']) assert.throws(() => createPlan(size, 4, '2026-03-01'), /bed/i);
});

test('saving and restoring preserves a portable plan in browser storage', () => {
  const values = new Map();
  const storage = { setItem: (key, value) => values.set(key, value), getItem: key => values.get(key) ?? null };
  assert.equal(loadLocalPlan(storage), null);
  const plan = { version: 1, startDate: '2026-03-01', layout: [['lettuce', null]] };
  saveLocalPlan(storage, plan);
  assert.deepEqual(loadLocalPlan(storage), plan);
  assert.equal(values.size, 1);
  saveLocalPlan(storage, plantSquare(plan, 0, 1, 'carrot'));
  assert.equal(analyzePlan(loadLocalPlan(storage)).totalPlants, 20);
  assert.equal(values.size, 1);
});

test('storage failures and damaged saved data surface instead of claiming a save succeeded', () => {
  const plan = createPlan(1, 1, '2026-03-01');
  const unavailable = { setItem: () => { throw new Error('storage unavailable'); }, getItem: () => '{broken' };
  assert.throws(() => saveLocalPlan(unavailable, plan), /storage unavailable/);
  assert.throws(() => loadLocalPlan(unavailable), /valid garden plan/i);
});
