const {
  getPlantsPerSquare,
  arePlantsCompatible,
  projectGrowth,
  planSeason,
  renderGrid,
} = require('../utils/squareFootGardening');

describe('Square Foot Gardening utils', () => {
  test('calculate spacing', () => {
    expect(getPlantsPerSquare('tomato')).toBe(1);
    expect(getPlantsPerSquare('lettuce')).toBe(4);
  });

  test('plant compatibility', () => {
    expect(arePlantsCompatible('tomato', 'basil')).toBe(true);
    expect(arePlantsCompatible('basil', 'tomato')).toBe(true);
    expect(arePlantsCompatible('tomato', 'carrot')).toBe(false);
    expect(arePlantsCompatible('carrot', 'tomato')).toBe(false);
  });

  test('growth projection', () => {
    const start = new Date('2024-03-01');
    const { harvestDate } = projectGrowth('lettuce', start);
    const diff = (harvestDate - start) / (1000 * 60 * 60 * 24);
    expect(diff).toBe(55);
  });

  test('plan season and render grid', () => {
    const layout = [
      ['tomato', 'basil'],
      ['lettuce', null],
    ];
    const plan = planSeason(layout, '2024-03-01', 'spring');
    expect(plan.grid).toBe('T B\nL -');
    expect(plan.schedule.length).toBe(3);
    // ensure no incompatible neighbors
    expect(() =>
      planSeason([
        ['tomato', 'carrot'],
      ], '2024-03-01', 'spring')
    ).toThrow();
  });
});
