// Interim application export, not a commons record or a reputation transfer.
// Only existing structural transaction fields and advertised listing fields
// cross this boundary. Never spread an entire DynamoDB record into a response.
function fields(item, names) {
  return Object.fromEntries(names.filter(name => Object.hasOwn(item, name)).map(name => [name, item[name]]));
}

const listingFields = ['id', 'userId', 'type', 'title', 'category', 'description', 'price', 'location',
  'media', 'logisticsRange', 'processingCategory', 'compostingService', 'availability', 'tags', 'createdAt'];
const transactionFields = ['id', 'transactionId', 'contractId', 'consumerId', 'producerId', 'buyerId',
  'sellerId', 'listingId', 'status', 'createdAt', 'lastPing', 'pingCount', 'buyerRated', 'sellerRated',
  'ratingGiven', 'dialogConfirmed', 'flaggedForReview', 'escrowLocked', 'escrowReleasedAt'];

module.exports = {
  listingFields, transactionFields,
  listing: item => fields(item, listingFields),
  transaction: item => fields(item, transactionFields),
};
