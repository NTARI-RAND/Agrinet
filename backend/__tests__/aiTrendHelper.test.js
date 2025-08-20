const mockListingCount = jest.fn();
const mockUserFind = jest.fn();
const mockTransactionCount = jest.fn();

jest.mock('../models/listing', () => ({ countDocuments: mockListingCount }));
jest.mock('../models/user', () => ({ find: mockUserFind }));
jest.mock('../models/transaction', () => ({ countDocuments: mockTransactionCount }));

const { generateAIInsight } = require('../utils/aiTrendHelper');

describe('generateAIInsight', () => {
  beforeEach(() => {
    mockListingCount.mockReset();
    mockUserFind.mockReset();
    mockTransactionCount.mockReset();
  });

  it('produces insights from listing and transaction data', async () => {
    mockListingCount.mockResolvedValueOnce(150);
    const mockLimit = jest.fn().mockReturnValue([{ name: 'Alice' }]);
    const mockSort = jest.fn().mockReturnValue({ limit: mockLimit });
    mockUserFind.mockReturnValue({ sort: mockSort });
    mockTransactionCount.mockResolvedValueOnce(12);

    const insights = await generateAIInsight('RegionX');

    expect(insights).toContain('📈 High listing volume detected in RegionX – over 100 active listings.');
    expect(insights).toContain('🏆 Top rated producers this week: Alice');
    expect(insights).toContain('⚠️ Several transactions are experiencing delays. Encourage producers to respond to PINGs promptly.');
});
});
