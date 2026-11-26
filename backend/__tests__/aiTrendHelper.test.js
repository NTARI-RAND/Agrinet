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
        promise: () => Promise.resolve({ Items: [{ username: 'Alice', reputationScore: 5 }] })
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

  describe('producer data in insight text', () => {
    const producer = (fields) => ({
      role: 'producer',
      password: '$2a$10$secrethashsecrethash',
      email: `${fields.id}@example.test`,
      phone: `+1555010${fields.id.slice(-1)}`,
      verified: true,
      location: 'RegionX',
      locationPrivacy: false,
      ...fields
    });

    const mockScans = (users) => {
      mockScan
        .mockReturnValueOnce({ promise: () => Promise.resolve({ Items: [] }) })
        .mockReturnValueOnce({ promise: () => Promise.resolve({ Items: users }) })
        .mockReturnValueOnce({ promise: () => Promise.resolve({ Items: [] }) });
    };

    const expectNoPrivateFields = (insights, users) => {
      const text = insights.join('\n');
      for (const user of users) {
        expect(text).not.toContain(user.password);
        expect(text).not.toContain(user.email);
        expect(text).not.toContain(user.phone);
      }
    };

    it('names producers by username, never by email, hash or phone', async () => {
      const users = [
        producer({ id: 'u1', username: 'alice', reputationScore: 5 }),
        producer({ id: 'u2', reputationScore: 4 })
      ];
      mockScans(users);

      const insights = await generateAIInsight(undefined, 'en');

      expect(insights).toContain('🏆 Top rated producers this week: alice');
      expectNoPrivateFields(insights, users);
    });

    it('omits the producer insight when no producer has a public name', async () => {
      const users = [producer({ id: 'u3', reputationScore: 5 })];
      mockScans(users);

      const insights = await generateAIInsight(undefined, 'en');

      expect(insights.some(i => i.startsWith('🏆'))).toBe(false);
      expectNoPrivateFields(insights, users);
    });

    it('leaves location-private producers out of region insights', async () => {
      const users = [
        producer({ id: 'u4', username: 'hidden', reputationScore: 9, locationPrivacy: true }),
        producer({ id: 'u5', username: 'shown', reputationScore: 1 })
      ];
      mockScans(users);

      const insights = await generateAIInsight('RegionX', 'en');

      expect(insights).toContain('🏆 Top rated producers this week: shown');
      expect(insights.join('\n')).not.toContain('hidden');
    });
  });
});
