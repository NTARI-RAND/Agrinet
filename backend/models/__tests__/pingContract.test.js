const {
  createPingContractItem,
  addNegotiation,
  addSignature,
  addPerformanceUpdate
} = require('../pingContract');

describe('pingContract model', () => {
  test('creates item with required fields', () => {
    const item = createPingContractItem({
      id: 'PING1',
      contractType: 'producer',
      producerId: 'prod1',
      pingRate: 'weekly',
      shareType: 'fixed',
      shareValue: 50
    });

    expect(item.id).toBe('PING1');
    expect(item.contractType).toBe('producer');
    expect(item.pingRate).toBe('weekly');
    expect(item.shareType).toBe('fixed');
    expect(item.shareValue).toBe(50);
    expect(item.attachments).toEqual([]);
  });

  test('throws when attachments exceed limit', () => {
    expect(() =>
      createPingContractItem({
        id: 'PING2',
        contractType: 'consumer',
        producerId: 'prod1',
        pingRate: 'daily',
        shareType: 'variable',
        attachments: [1,2,3,4,5,6]
      })
    ).toThrow('Attachments limit exceeded');
  });

  test('negotiation, signature and performance updates append', () => {
    const contract = createPingContractItem({
      id: 'PING3',
      contractType: 'open',
      producerId: 'prod1',
      pingRate: 'monthly',
      shareType: 'variable'
    });

    addNegotiation(contract, { partyId: 'user1', message: 'offer A' });
    addSignature(contract, { partyId: 'user1', signature: 'sig' });
    addPerformanceUpdate(contract, { update: 'on track', attachments: ['a'] });

    expect(contract.negotiationHistory.length).toBe(1);
    expect(contract.signatures.length).toBe(1);
    expect(contract.performanceUpdates.length).toBe(1);
  });

  test('performance update attachments limit enforced', () => {
    const contract = createPingContractItem({
      id: 'PING4',
      contractType: 'open',
      producerId: 'prod1',
      pingRate: 'monthly',
      shareType: 'variable'
    });

    expect(() =>
      addPerformanceUpdate(contract, { update: 'fail', attachments: [1,2,3,4,5,6] })
    ).toThrow('Attachments limit exceeded');
  });
});
