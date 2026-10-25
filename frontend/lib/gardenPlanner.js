const {
  PLANT_SPACING, arePlantsCompatible, getPlantsPerSquare, projectGrowth,
} = require('../../backend/utils/squareFootGardening');

const CROPS = Object.keys(PLANT_SPACING);
const STORAGE_KEY = 'agrinet:garden-plan:v1';
const MAX_PLAN_BYTES = 32768;

function checkDimensions(rows, columns) {
  if (![rows, columns].every(value => Number.isInteger(value) && value >= 1 && value <= 8)) {
    throw new Error('Bed dimensions must be whole numbers from 1 to 8 feet.');
  }
}

function checkDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value) || value.startsWith('0000')) {
    throw new Error('Choose a valid planting date.');
  }
  const parsed = new Date(`${value}T00:00:00Z`);
  if (Number.isNaN(parsed.valueOf()) || parsed.toISOString().split('T')[0] !== value) {
    throw new Error('Choose a valid planting date.');
  }
}

function validatePlan(plan) {
  if (!plan || plan.version !== 1 || !Array.isArray(plan.layout) || !Array.isArray(plan.layout[0])) {
    throw new Error('This is not a supported Agrinet garden plan.');
  }
  checkDate(plan.startDate);
  checkDimensions(plan.layout.length, plan.layout[0].length);
  if (!plan.layout.every(row => Array.isArray(row) && row.length === plan.layout[0].length)) {
    throw new Error('The garden bed must be rectangular.');
  }
  if (!plan.layout.every(row => row.every(crop => crop === null || CROPS.includes(crop)))) {
    throw new Error('The plan contains an unsupported crop.');
  }
  return plan;
}

function createPlan(rows, columns, startDate) {
  checkDimensions(rows, columns);
  checkDate(startDate);
  return { version: 1, startDate, layout: Array.from({ length: rows }, () => Array(columns).fill(null)) };
}

function resizePlan(plan, rows, columns) {
  validatePlan(plan);
  const resized = createPlan(rows, columns, plan.startDate);
  resized.layout = resized.layout.map((row, r) => row.map((_, c) => plan.layout[r]?.[c] ?? null));
  return resized;
}

function plantSquare(plan, row, column, crop) {
  validatePlan(plan);
  if (!Number.isInteger(row) || !Number.isInteger(column) || row < 0 || column < 0 || row >= plan.layout.length || column >= plan.layout[0].length) {
    throw new Error('Choose a square inside the garden bed.');
  }
  if (crop !== null && !CROPS.includes(crop)) throw new Error('Choose a supported crop.');
  return { ...plan, layout: plan.layout.map((cells, r) => cells.map((value, c) => r === row && c === column ? crop : value)) };
}

function previewResize(plan, rows, columns) {
  const resized = resizePlan(plan, rows, columns);
  return { plan: resized, removedSquares: analyzePlan(plan).occupiedSquares - analyzePlan(resized).occupiedSquares };
}

function analyzePlan(plan) {
  validatePlan(plan);
  const counts = new Map();
  const conflicts = [];
  plan.layout.forEach((row, r) => row.forEach((crop, c) => {
    if (!crop) return;
    counts.set(crop, (counts.get(crop) || 0) + 1);
    for (const [nr, nc] of [[r, c + 1], [r + 1, c]]) {
      const neighbor = plan.layout[nr]?.[nc];
      if (neighbor && !arePlantsCompatible(crop, neighbor)) {
        conflicts.push({ first: [r, c], second: [nr, nc], crops: [crop, neighbor] });
      }
    }
  }));
  const crops = Array.from(counts, ([crop, squares]) => ({
    crop, squares, plants: squares * getPlantsPerSquare(crop),
    harvestDate: projectGrowth(crop, plan.startDate).harvestDate.toISOString().split('T')[0],
  })).sort((a, b) => a.harvestDate.localeCompare(b.harvestDate) || a.crop.localeCompare(b.crop));
  return {
    area: plan.layout.length * plan.layout[0].length,
    occupiedSquares: crops.reduce((sum, crop) => sum + crop.squares, 0),
    totalPlants: crops.reduce((sum, crop) => sum + crop.plants, 0),
    crops, conflicts,
  };
}

function serializePlan(plan) {
  validatePlan(plan);
  return JSON.stringify({ version: 1, startDate: plan.startDate, layout: plan.layout }, null, 2);
}

function parsePlan(text) {
  if (typeof text !== 'string' || text.length > MAX_PLAN_BYTES) throw new Error('Plan file is too large. Maximum size is 32 KB.');
  let plan;
  try { plan = JSON.parse(text); } catch { throw new Error('Choose a valid garden plan JSON file.'); }
  validatePlan(plan);
  // Only portable planning fields survive import; no extra metadata is retained.
  return JSON.parse(serializePlan(plan));
}

function saveLocalPlan(storage, plan) {
  storage.setItem(STORAGE_KEY, serializePlan(plan));
}

function loadLocalPlan(storage) {
  const saved = storage.getItem(STORAGE_KEY);
  return saved === null ? null : parsePlan(saved);
}

module.exports = { CROPS, MAX_PLAN_BYTES, createPlan, analyzePlan, resizePlan, previewResize, plantSquare, serializePlan, parsePlan, saveLocalPlan, loadLocalPlan };
