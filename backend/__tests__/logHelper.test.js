jest.mock('../lib/dynamodbClient', () => ({ put: jest.fn() }));
const docClient = require('../lib/dynamodbClient');
const { logTransactionEvent } = require('../utils/logHelper');

test('logTransactionEvent persists the supplied event with a timestamp', async () => {
  docClient.put.mockReturnValue({ promise: async () => ({}) });
  const event = { transactionId: 't1', actorId: 'a1', action: 'CREATE', note: 'test' };
  await logTransactionEvent(event);
  expect(docClient.put).toHaveBeenCalledWith({
    TableName: 'TransactionLogs',
    Item: { ...event, timestamp: expect.any(String) },
  });
});
