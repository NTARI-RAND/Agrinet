const PLANT_SPACING = {
  tomato: 1, // one plant per square foot
  lettuce: 4,
  carrot: 16,
  basil: 1,
};

const COMPATIBILITY_MATRIX = {
  tomato: { compatible: ['basil'], incompatible: ['carrot'] },
  lettuce: { compatible: ['carrot'], incompatible: ['basil'] },
  carrot: { compatible: ['lettuce'], incompatible: ['tomato'] },
  basil: { compatible: ['tomato'], incompatible: ['lettuce'] },
};

const GROWTH_DATA = {
  tomato: { daysToMaturity: 70 },
  lettuce: { daysToMaturity: 55 },
  carrot: { daysToMaturity: 65 },
  basil: { daysToMaturity: 60 },
};

const SEASONAL_WINDOWS = {
  spring: ['March', 'April', 'May'],
  summer: ['June', 'July', 'August'],
  fall: ['September', 'October', 'November'],
  winter: ['December', 'January', 'February'],
};

function getPlantsPerSquare(plant) {
  return PLANT_SPACING[plant] || 1;
}

function arePlantsCompatible(a, b) {
  const aData = COMPATIBILITY_MATRIX[a];
  const bData = COMPATIBILITY_MATRIX[b];
  if (aData && aData.incompatible.includes(b)) return false;
  if (bData && bData.incompatible.includes(a)) return false;
  return true;
}

function projectGrowth(plant, startDate) {
  const data = GROWTH_DATA[plant];
  if (!data) throw new Error(`Unknown plant ${plant}`);
  const start = new Date(startDate);
  const harvest = new Date(start);
  harvest.setDate(start.getDate() + data.daysToMaturity);
  return { plant, startDate: start, harvestDate: harvest };
}

function renderGrid(layout) {
  const rows = layout.map(row =>
    row.map(plant => (plant ? plant[0].toUpperCase() : '-')).join(' ')
  );
  return rows.join('\n');
}

function planSeason(layout, startDate, season) {
  const months = SEASONAL_WINDOWS[season];
  if (!months) throw new Error(`Unknown season ${season}`);
  const schedule = [];
  layout.forEach((row, rIdx) => {
    row.forEach((plant, cIdx) => {
      if (!plant) return;
      // check adjacent cells for compatibility
      const neighbors = [
        layout[rIdx - 1]?.[cIdx],
        layout[rIdx + 1]?.[cIdx],
        layout[rIdx]?.[cIdx - 1],
        layout[rIdx]?.[cIdx + 1],
      ].filter(Boolean);
      neighbors.forEach(n => {
        if (!arePlantsCompatible(plant, n)) {
          throw new Error(`Incompatible neighbors: ${plant} and ${n}`);
        }
      });
      const growth = projectGrowth(plant, startDate);
      schedule.push({
        plant,
        position: [rIdx, cIdx],
        startDate: growth.startDate,
        harvestDate: growth.harvestDate,
      });
    });
  });
  return { grid: renderGrid(layout), schedule, seasonMonths: months };
}

module.exports = {
  getPlantsPerSquare,
  arePlantsCompatible,
  projectGrowth,
  planSeason,
  renderGrid,
  PLANT_SPACING,
  COMPATIBILITY_MATRIX,
  GROWTH_DATA,
  SEASONAL_WINDOWS,
};
