const { test, mock } = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const Module = require('module');

const keyModelPath = path.join(__dirname, '..', '..', 'models', 'key.js');
const keyLibraryPath = path.join(__dirname, '..', '..', 'models', 'KeyLibrary.js');

// Patch module resolution to map to our mocked paths
const originalResolve = Module._resolveFilename;
Module._resolveFilename = function (request, parent, isMain, options) {
  if (request.includes('/models/KeyLibrary')) return keyLibraryPath;
  if (request.includes('/models/key')) return keyModelPath;
  return originalResolve.call(this, request, parent, isMain, options);
};

// Mock the key model functions as required
require.cache[keyModelPath] = {
  id: keyModelPath,
  filename: keyModelPath,
  loaded: true,
  exports: {
    createKeyItem: mock.fn(),
    putKey: mock.fn(),
    getKeyByValue: mock.fn(),
    updateKey: mock.fn()
  },
// Use mock.import to mock required modules instead of patching Module internals

// Mock the key model functions as required
const keyModelMock = {
  createKeyItem: mock.fn(),
  putKey: mock.fn(),
  getKeyByValue: mock.fn(),
  updateKey: mock.fn()
};

// In-memory store for keys
const activeKeys = [];

// Mocked KeyLibrary model
const saveMock = mock.fn(async function () {
  if (!activeKeys.includes(this)) {
    activeKeys.push(this);
  }
  return this;
});

function KeyLibrary(data) {
  Object.assign(this, data);
  this.save = saveMock;
}

KeyLibrary.find = mock.fn(async ({ userId, retired }) => {
  if (!userId) throw new Error('userId required');
  return activeKeys.filter(k => k.userId === userId && k.retired === retired);
});

KeyLibrary.findOne = mock.fn(async ({ userId, key, retired }) => {
  return activeKeys.find(k => k.userId === userId && k.key === key && k.retired === retired) || null;
});

KeyLibrary.countDocuments = mock.fn(async () => 0);
KeyLibrary.updateMany = mock.fn(async () => {});

require.cache[keyLibraryPath] = {
  id: keyLibraryPath,
  filename: keyLibraryPath,
  loaded: true,
  exports: KeyLibrary,
  children: []
};

// Import controller after mocking dependencies
const { issueKey, validateKey } = require(path.join(__dirname, '..', '..', 'controllers', 'key_controller.js'));

function createRes() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(obj) { this.body = obj; }
  };
}

test('issueKey returns seven keys when provided userId', async () => {
  activeKeys.length = 0;
  for (let i = 0; i < 7; i++) {
    const req = { body: { userId: 'user1' } };
    const res = createRes();
    await issueKey(req, res);
    assert.equal(res.statusCode, 201);
    assert.ok(res.body.data.key);
  }
  assert.equal(activeKeys.length, 7);

  // 8th key should fail
  const req = { body: { userId: 'user1' } };
  const res = createRes();
  await issueKey(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Max key limit reached');
});

test('validateKey increments usageCount and returns key data', async () => {
  activeKeys.length = 0;
  const key = new KeyLibrary({ userId: 'user1', key: 'k1', transmissions: 0, retired: false });
  activeKeys.push(key);
  const req = { body: { userId: 'user1', key: 'k1' } };
  const res = createRes();
  await validateKey(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Key validated');
  assert.equal(res.body.keyData.transmissions, 1);
});

test('validateKey retires key and replaces after reaching limit', async () => {
  activeKeys.length = 0;
  const key = new KeyLibrary({ userId: 'user1', key: 'k1', transmissions: 2, retired: false });
  activeKeys.push(key);
  const req = { body: { userId: 'user1', key: 'k1' } };
  const res = createRes();
  await validateKey(req, res);
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.message, 'Key retired and replaced');
  assert.equal(res.body.retiredKey.retired, true);
  assert.equal(res.body.newKey.transmissions, 0);
  assert.equal(activeKeys.length, 2);
});

test('issueKey responds with error when userId missing', async () => {
  const req = { body: {} };
  const res = createRes();
  await issueKey(req, res);
  assert.equal(res.statusCode, 500);
  assert.ok(res.body.error);
});

test('validateKey responds with error when key is missing', async () => {
  activeKeys.length = 0;
  const req = { body: { userId: 'user1' } };
  const res = createRes();
  await validateKey(req, res);
  assert.equal(res.statusCode, 400);
  assert.equal(res.body.error, 'Invalid or retired key');
});

