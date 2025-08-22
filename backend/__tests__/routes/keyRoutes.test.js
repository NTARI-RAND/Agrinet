const request = require('supertest');
const express = require('express');

// Mock the controller functions before importing the routes
jest.mock('../../controllers/key_controller', () => ({
  issueKey: jest.fn((req, res) => res.status(201).json({ message: 'issued' })),
  validateKey: jest.fn((req, res) => res.status(200).json({ message: 'validated' })),
}));

const keyRoutes = require('../../routes/keyRoutes');
const { issueKey, validateKey } = require('../../controllers/key_controller');

const app = express();
app.use(express.json());
app.use('/', keyRoutes);

describe('keyRoutes', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test('POST /issue-key calls issueKey controller and returns 201', async () => {
    const res = await request(app).post('/issue-key').send({ userId: '123' });
    expect(issueKey).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(201);
  });

  test('POST /validate-key calls validateKey controller and returns 200', async () => {
    const res = await request(app).post('/validate-key').send({ userId: '123', key: 'abc' });
    expect(validateKey).toHaveBeenCalledTimes(1);
    expect(res.status).toBe(200);
  });
});

