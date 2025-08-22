const request = require('supertest');
const express = require('express');

// Mock DocumentClient
jest.mock('../../lib/dynamodbClient', () => ({
  scan: jest.fn(),
  put: jest.fn(),
}));

// Mock axios webhook
jest.mock('axios', () => ({
  post: jest.fn(),
}));

const docClient = require('../../lib/dynamodbClient');
const axios = require('axios');

function createApp() {
  // delete cached router to reset in-memory cache
  delete require.cache[require.resolve('../contracts')];
  const router = require('../contracts');
  const app = express();
  app.use(express.json());
  app.use('/contracts', router);
  return app;
}

describe('contracts routes', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('GET /contracts caches results', async () => {
    docClient.scan.mockResolvedValueOnce({ Items: [{ id: '1' }] });
    const app = createApp();

    const first = await request(app).get('/contracts');
    expect(first.status).toBe(200);
    expect(first.body).toEqual([{ id: '1' }]);

    const second = await request(app).get('/contracts');
    expect(second.body).toEqual([{ id: '1' }]);
    expect(docClient.scan).toHaveBeenCalledTimes(1);
  });

  test('POST /contracts stores contract, calls webhook and invalidates cache', async () => {
    // Seed cache with initial scan
    docClient.scan.mockResolvedValueOnce({ Items: [{ id: 'cached' }] });
    const app = createApp();
    await request(app).get('/contracts');
    expect(docClient.scan).toHaveBeenCalledTimes(1);

    // Prepare mocks for creation
    const id = 'uuid-1234';
    jest.spyOn(require('crypto'), 'randomUUID').mockReturnValue(id);
    docClient.put.mockResolvedValue({});
    axios.post.mockResolvedValue({});

    const payload = { type: 'fruit', amountNeeded: 5 };
    const postRes = await request(app).post('/contracts').send(payload);
    expect(postRes.status).toBe(200);
    // Response should include generated id either at top level or within data
    const returnedId = postRes.body.id || (postRes.body.data && postRes.body.data.id);
    expect(returnedId).toBe(id);
    expect(docClient.put).toHaveBeenCalledWith(expect.objectContaining({
      Item: expect.objectContaining({ id })
    }));
    expect(axios.post).toHaveBeenCalledWith(
      'https://www.ntari.org/_functions/webhookUpdate',
      { contractId: id, status: 'created' }
    );

    // After creation cache should be invalidated -> next GET triggers new scan
    docClient.scan.mockResolvedValueOnce({ Items: [{ id: 'cached' }, { id }] });
    const getAfterPost = await request(app).get('/contracts');
    expect(getAfterPost.body).toEqual([{ id: 'cached' }, { id }]);
    expect(docClient.scan).toHaveBeenCalledTimes(2);
  });
});

