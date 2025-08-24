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
  id,
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

/** Add a negotiation entry */
function addNegotiation(contract, { partyId, message, timestamp = new Date().toISOString() }) {
  contract.negotiationHistory.push({ partyId, message, timestamp });
  return contract;
}

/** Add a digital signature */
function addSignature(contract, { partyId, signature, signedAt = new Date().toISOString() }) {
  contract.signatures.push({ partyId, signature, signedAt });
  return contract;
}

/** Add a performance update with optional attachments (max 5) */
function addPerformanceUpdate(contract, { update, attachments = [], timestamp = new Date().toISOString() }) {
  if (attachments.length > 5) {
    throw new Error('Attachments limit exceeded (max 5)');
  }
  contract.performanceUpdates.push({ update, attachments, timestamp });
  return contract;
}

module.exports = {
  PING_CONTRACT_TABLE_NAME,
  createPingContractItem,
  addNegotiation,
  addSignature,
  addPerformanceUpdate
};
