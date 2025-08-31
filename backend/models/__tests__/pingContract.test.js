const {
  createPingContractItem,
  createConsumerPlan,
  createProducerPlan,
  createOpenPingPost,
  addNegotiation,
  addSignature,
  addPerformanceUpdate,
  updateLbtasRating,
  renewContract
} = require('../pingContract');

describe('pingContract model', () => {
  test('auto assigns id and template types', () => {
    const consumer = createConsumerPlan({
      producerId: 'p1',
      pingRate: 'daily',
      shareType: 'fixed'
    });
    const producer = createProducerPlan({
      id: 'PING1',
      producerId: 'p2',
      pingRate: 'weekly',
      shareType: 'variable'
    });
    const open = createOpenPingPost({
      producerId: 'p3',
      pingRate: 'monthly',
      shareType: 'fixed'
    });

    expect(consumer.id).toBeDefined();
    expect(consumer.contractType).toBe('consumer');
    expect(producer.id).toBe('PING1');
    expect(producer.contractType).toBe('producer');
    expect(open.contractType).toBe('open');
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

  test('requires attachments to be an array', () => {
    expect(() =>
      createPingContractItem({
        id: 'PING5',
        contractType: 'consumer',
        producerId: 'prod1',
        pingRate: 'daily',
        shareType: 'fixed',
        attachments: 'not-array'
      })
    ).toThrow('Attachments must be an array');
  });

  test('negotiation, signature, performance, rating and renewal work', () => {
    let contract = createPingContractItem({
      producerId: 'prod1',
      contractType: 'open',
      pingRate: 'monthly',
      shareType: 'variable'
    });

    contract = addNegotiation(contract, { partyId: 'user1', message: 'offer A' });
    contract = addSignature(contract, { partyId: 'user1', signature: 'sig' });
    contract = addPerformanceUpdate(contract, { update: 'on track', attachments: ['a'] });
    contract = updateLbtasRating(contract, 5);
    contract = renewContract(contract, { renewalDate: '2025-01-01', calendarEventId: 'cal1' });

    expect(contract.negotiationHistory.length).toBe(1);
    expect(contract.signatures.length).toBe(1);
    expect(contract.performanceUpdates.length).toBe(1);
    expect(contract.lbtasRating).toBe(5);
    expect(contract.autoRenew).toBe(true);
    expect(contract.renewalDate).toBe('2025-01-01');
    expect(contract.calendarEventId).toBe('cal1');
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

  test('performance update attachments must be array', () => {
    const contract = createPingContractItem({
      id: 'PING6',
      contractType: 'open',
      producerId: 'prod1',
      pingRate: 'monthly',
      shareType: 'variable'
    });

    expect(() =>
      addPerformanceUpdate(contract, { update: 'bad', attachments: 'oops' })
    ).toThrow('Attachments must be an array');
  });
});
