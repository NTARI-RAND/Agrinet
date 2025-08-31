const { randomUUID } = require('crypto');

const PING_CONTRACT_TABLE_NAME = "PingContracts";

/**
 * Build a PING contract item for DynamoDB
 * @param {Object} params
 * @param {string} params.id - unique PING identifier
 * @param {string} params.contractType - consumer | producer | open
 * @param {string} params.producerId
 * @param {string} params.consumerId
 * @param {string} params.pingRate - daily | weekly | monthly
 * @param {string} params.shareType - fixed | variable
 * @param {number} [params.shareValue]
 * @param {Array} [params.attachments]
 * @param {Array} [params.negotiationHistory]
 * @param {Array} [params.signatures]
 * @param {Array} [params.performanceUpdates]
 * @param {number|null} [params.lbtasRating]
 * @param {boolean} [params.autoRenew]
 * @param {string|null} [params.renewalDate]
 * @param {string|null} [params.calendarEventId]
 * @param {string} [params.status]
 */
function createPingContractItem({
  id = randomUUID(),
  contractType,
  producerId,
  consumerId = null,
  pingRate,
  shareType,
  shareValue = null,
  attachments = [],
  negotiationHistory = [],
  signatures = [],
  performanceUpdates = [],
  lbtasRating = null,
  autoRenew = false,
  renewalDate = null,
  calendarEventId = null,
  status = 'open'
}) {
  if (!Array.isArray(attachments)) {
    throw new Error('Attachments must be an array');
  }
  if (attachments.length > 5) {
    throw new Error('Attachments limit exceeded (max 5)');
  }

  return {
    id,
    contractType,
    producerId,
    consumerId,
    pingRate,
    shareType,
    shareValue,
    attachments,
    negotiationHistory,
    signatures,
    performanceUpdates,
    lbtasRating,
    autoRenew,
    renewalDate,
    calendarEventId,
    status
  };
}

/** Convenience templates */
function createConsumerPlan(params) {
  return createPingContractItem({ ...params, contractType: 'consumer' });
}

function createProducerPlan(params) {
  return createPingContractItem({ ...params, contractType: 'producer' });
}

function createOpenPingPost(params) {
  return createPingContractItem({ ...params, contractType: 'open' });
}

/** Add a negotiation entry */
function addNegotiation(contract, { partyId, message, timestamp = new Date().toISOString() }) {
  const negotiationHistory = [
    ...(contract.negotiationHistory || []),
    { partyId, message, timestamp }
  ];
  return { ...contract, negotiationHistory };
}

/** Add a digital signature */
function addSignature(contract, { partyId, signature, signedAt = new Date().toISOString() }) {
  const signatures = [
    ...(contract.signatures || []),
    { partyId, signature, signedAt }
  ];
  return { ...contract, signatures };
}

/** Add a performance update with optional attachments (max 5) */
function addPerformanceUpdate(contract, { update, attachments = [], timestamp = new Date().toISOString() }) {
  if (!Array.isArray(attachments)) {
    throw new Error('Attachments must be an array');
  }
  if (attachments.length > 5) {
    throw new Error('Attachments limit exceeded (max 5)');
  }
  const performanceUpdates = Array.isArray(contract.performanceUpdates) ? [...contract.performanceUpdates] : [];
  performanceUpdates.push({ update, attachments, timestamp });
  return { ...contract, performanceUpdates };
}

/** Update LBTAS rating */
function updateLbtasRating(contract, rating) {
  return { ...contract, lbtasRating: rating };
}

/** Renew contract and link to calendar event */
function renewContract(contract, { renewalDate, calendarEventId = null }) {
  return {
    ...contract,
    autoRenew: true,
    renewalDate,
    calendarEventId
  };
}

module.exports = {
  PING_CONTRACT_TABLE_NAME,
  createPingContractItem,
  createConsumerPlan,
  createProducerPlan,
  createOpenPingPost,
  addNegotiation,
  addSignature,
  addPerformanceUpdate,
  updateLbtasRating,
  renewContract
};
