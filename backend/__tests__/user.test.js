const { describe, it } = require('node:test');
const assert = require('node:assert');
const { createUserItem } = require('../models/user');

describe('createUserItem', () => {
  it('creates a user item with defaults', () => {
    const item = createUserItem({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      phone: '1234567890',
      password: 'hashed',
      location: 'Earth'
    });

    assert.deepStrictEqual(item, {
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      phone: '1234567890',
      password: 'hashed',
      verified: false,
      location: 'Earth',
      locationPrivacy: false,
      role: 'consumer',
      reputationScore: 0,
      reputationWeight: 0
    });
  });
});
