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

    expect(item).toEqual({
      id: '1',
      username: 'testuser',
      email: 'test@example.com',
      phone: '1234567890',
      password: 'hashed',
      verified: false,
      location: 'Earth',
      role: 'consumer',
      reputationScore: 0
    });
  });
});
