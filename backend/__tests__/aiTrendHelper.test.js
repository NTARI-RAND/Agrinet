const mockScan = jest.fn();

jest.mock('../lib/dynamodbClient', () => ({
  scan: mockScan
}));

const { generateAIInsight } = require('../utils/aiTrendHelper');

describe('generateAIInsight', () => {
  beforeEach(() => {
    mockScan.mockReset();
  });

  it('produces localized insights from marketplace data', async () => {
    // Mock listing scan
    mockScan
      .mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: Array(150).fill({}) })
      })
      // Mock user scan
      .mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: [{ name: 'Alice', reputationScore: 5 }] })
      })
      // Mock transaction scan
      .mockReturnValueOnce({
        promise: () => Promise.resolve({ Items: Array(12).fill({}) })
      });

    const insights = await generateAIInsight('RegionX', 'es-MX');

    expect(insights).toContain('📈 Chorro de anuncios en RegionX – más de 100 activos.');
    expect(insights).toContain('🏆 productores mejor valorados esta semana: Alice');
    expect(
      insights
    ).toContain('⚠️ Varias transacciones están experimentando retrasos. Incentiva a los productores a responder a los PINGs rápidamente.');
  });
});
