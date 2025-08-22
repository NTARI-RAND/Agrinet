jest.mock('../models/transactionLog', () => {
  return function(data) {
    return { save: mockSave };
  };
});

const mockSave = jest.fn().mockResolvedValue();
const { logTransactionEvent } = require('../utils/logHelper');

describe('logTransactionEvent', () => {
  it('saves a transaction log entry', async () => {
    await logTransactionEvent({ transactionId: 't1', actorId: 'a1', action: 'CREATE', note: 'test' });
    expect(mockSave).toHaveBeenCalled();
  });
});
