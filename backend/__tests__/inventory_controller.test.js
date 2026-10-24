jest.mock('../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  put: jest.fn(),
  update: jest.fn()
}));
jest.mock('axios', () => ({ get: jest.fn() }));

const docClient = require('../lib/dynamodbClient');
const axios = require('axios');
const controller = require('../controllers/inventory_controller');
const { createRes } = require('./testUtils');

describe('inventory controller', () => {
  const timestamp = '2026-01-01T00:00:00.000Z';
  let res;

  beforeEach(() => {
    jest.useFakeTimers().setSystemTime(new Date(timestamp));
    jest.replaceProperty(process, 'env', {
      ...process.env,
      EXTERNAL_INVENTORY_URL: 'https://inventory.example.test/items'
    });
    for (const method of Object.values(docClient)) {
      method.mockReset().mockReturnValue({ promise: async () => ({}) });
    }
    axios.get.mockReset();
    res = createRes();
  });

  afterEach(() => {
    jest.restoreAllMocks();
    jest.useRealTimers();
  });

  test.each([
    [{ Items: [{ id: 'tomatoes' }] }, [{ id: 'tomatoes' }]],
    [{}, []]
  ])('lists inventory from scan result %j', async (result, expected) => {
    docClient.scan.mockReturnValue({ promise: async () => result });

    await controller.getInventory({}, res);

    expect(docClient.scan).toHaveBeenCalledWith({ TableName: 'Inventory' });
    expect(res.body).toEqual(expected);
    expect(res.statusCode).toBe(200);
  });

  test('creates and returns inventory with model defaults', async () => {
    const body = { id: 'tomatoes', name: 'Tomatoes', category: 'fresh', unit: 'kg' };

    await controller.createInventory({ body }, res);

    expect(res.statusCode).toBe(201);
    expect(res.body).toEqual({
      ...body, stock: 0, seasons: [], price: 0, batch: null, lot: null,
      externalId: null, createdAt: timestamp, updatedAt: timestamp
    });
    expect(docClient.put).toHaveBeenCalledWith({ TableName: 'Inventory', Item: res.body });
  });

  test.each([
    [{}, '', {}],
    [{ batch: 'harvest-1' }, ', batch = :b', { ':b': 'harvest-1' }],
    [{ lot: 'field-2' }, ', lot = :l', { ':l': 'field-2' }],
    [{ batch: '', lot: null }, ', batch = :b, lot = :l', { ':b': '', ':l': null }]
  ])('updates stock with optional fields %j', async (fields, suffix, values) => {
    const updated = { id: 'tomatoes', stock: 0, ...fields };
    docClient.update.mockReturnValue({ promise: async () => ({ Attributes: updated }) });

    await controller.updateStock({ params: { id: updated.id }, body: { stock: 0, ...fields } }, res);

    expect(docClient.update).toHaveBeenCalledWith({
      TableName: 'Inventory', Key: { id: updated.id },
      UpdateExpression: `set stock = :s, updatedAt = :u${suffix}`,
      ExpressionAttributeValues: { ':s': 0, ':u': timestamp, ...values },
      ReturnValues: 'ALL_NEW'
    });
    expect(res.body).toEqual(updated);
  });

  test('updates price and returns stored attributes', async () => {
    const updated = { id: 'tomatoes', price: 0 };
    docClient.update.mockReturnValue({ promise: async () => ({ Attributes: updated }) });

    await controller.updatePrice({ params: { id: updated.id }, body: { price: 0 } }, res);

    expect(docClient.update).toHaveBeenCalledWith({
      TableName: 'Inventory', Key: { id: updated.id },
      UpdateExpression: 'set price = :p, updatedAt = :u',
      ExpressionAttributeValues: { ':p': 0, ':u': timestamp },
      ReturnValues: 'ALL_NEW'
    });
    expect(res.body).toEqual(updated);
  });

  test('imports external inventory preserving supplied fields', async () => {
    const items = ['tomatoes', 'beans'].map(id => ({
      id, name: id, category: 'fresh', stock: 12, unit: 'kg', seasons: ['summer'],
      price: 3, batch: 'harvest-1', lot: 'field-2', externalId: `external-${id}`,
      createdAt: '2025-12-01T00:00:00.000Z', updatedAt: timestamp
    }));
    axios.get.mockResolvedValue({ data: items });

    await controller.syncExternal({}, res);

    expect(axios.get).toHaveBeenCalledWith(process.env.EXTERNAL_INVENTORY_URL);
    expect(docClient.put.mock.calls).toEqual(items.map(Item => [{ TableName: 'Inventory', Item }]));
    expect(res.body).toEqual({ imported: 2 });
  });

  test.each([[], { items: [] }, null])('imports no records from %j', async data => {
    axios.get.mockResolvedValue({ data });

    await controller.syncExternal({}, res);

    expect(res.body).toEqual({ imported: 0 });
    expect(docClient.put).not.toHaveBeenCalled();
  });

  test('rejects external sync when endpoint is not configured', async () => {
    delete process.env.EXTERNAL_INVENTORY_URL;

    await controller.syncExternal({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'EXTERNAL_INVENTORY_URL not configured' });
    expect(axios.get).not.toHaveBeenCalled();
    expect(docClient.put).not.toHaveBeenCalled();
  });

  test.each([
    ['getInventory', 'scan', 'Error fetching inventory'],
    ['createInventory', 'put', 'Error creating inventory item'],
    ['updateStock', 'update', 'Error updating stock'],
    ['updatePrice', 'update', 'Error updating price'],
    ['syncExternal', 'put', 'Error syncing external inventory']
  ])('%s reports storage failure', async (handler, method, error) => {
    docClient[method].mockReturnValue({ promise: async () => { throw new Error('storage unavailable'); } });
    axios.get.mockResolvedValue({ data: [{ id: 'tomatoes' }, { id: 'beans' }] });

    await controller[handler]({ params: { id: 'tomatoes' }, body: { stock: 1, price: 2 } }, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error });
    expect(docClient[method]).toHaveBeenCalledTimes(1);
  });

  test('reports external fetch failure without writing inventory', async () => {
    axios.get.mockRejectedValue(new Error('upstream unavailable'));

    await controller.syncExternal({}, res);

    expect(res.statusCode).toBe(500);
    expect(res.body).toEqual({ error: 'Error syncing external inventory' });
    expect(docClient.put).not.toHaveBeenCalled();
  });
});
