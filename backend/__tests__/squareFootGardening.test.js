const {
  getPlantsPerSquare,
  arePlantsCompatible,
  projectGrowth,
  planSeason,
  compareGardenPlans,
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

describe('compareGardenPlans', () => {
  const spring = { startDate: '2024-03-01', season: 'spring' };

  test('reports no changes for equivalent plans', () => {
    const before = { ...spring, layout: [['tomato', null]] };
    const after = { ...spring, layout: [['tomato', null]], startDate: new Date(spring.startDate) };

    expect(compareGardenPlans(before, after)).toEqual([]);
  });

  test('reports the replacement crop and harvest dates for the changed square', () => {
    const before = { ...spring, layout: [['tomato'], [null, 'lettuce']] };
    const after = { ...spring, layout: [['basil'], [null, 'lettuce']] };

    expect(compareGardenPlans(before, after)).toEqual([
      {
        position: [0, 0],
        before: { plant: 'tomato', harvestDate: new Date('2024-05-10') },
        after: { plant: 'basil', harvestDate: new Date('2024-04-30') },
      },
    ]);
  });

  test('reports a new harvest date when an existing crop is planted later', () => {
    const before = { ...spring, layout: [['lettuce']] };
    const after = { ...before, startDate: '2024-03-08' };

    expect(compareGardenPlans(before, after)).toEqual([
      {
        position: [0, 0],
        before: { plant: 'lettuce', harvestDate: new Date('2024-04-25') },
        after: { plant: 'lettuce', harvestDate: new Date('2024-05-02') },
      },
    ]);
  });

  test('reports planted and removed squares in row order across different bed sizes', () => {
    const before = { ...spring, layout: [[null], ['lettuce']] };
    const after = { ...spring, layout: [[null, 'carrot']] };

    expect(compareGardenPlans(before, after)).toEqual([
      {
        position: [0, 1],
        before: null,
        after: { plant: 'carrot', harvestDate: new Date('2024-05-05') },
      },
      {
        position: [1, 0],
        before: { plant: 'lettuce', harvestDate: new Date('2024-04-25') },
        after: null,
      },
    ]);
  });

  test('rejects a candidate with incompatible neighboring crops', () => {
    const before = { ...spring, layout: [['tomato', 'basil']] };
    const after = { ...spring, layout: [['tomato', 'carrot']] };

    expect(() => compareGardenPlans(before, after)).toThrow(/Incompatible neighbors/);
  });
});
