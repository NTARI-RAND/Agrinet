// DynamoDB helper for Transactions table
const TRANSACTION_TABLE_NAME = "Transactions";

function createTransactionItem({
  id,
  buyerId,
  sellerId,
  listingId,
  listingTitle,
  status = "pending",
  createdAt = new Date().toISOString(),
  buyerRated = false,
  sellerRated = false,
  ratingGiven = false,
  lastPing = new Date().toISOString(),
  pingCount = 0,
  dialogNotes = "",
  dialogConfirmed = false,
  flaggedForReview = false,
  escrowLocked = true,
  escrowReleasedAt = null
}) {
  return {
    id, // partition key
    buyerId,
    sellerId,
    listingId,
    listingTitle,
    status,
    createdAt,
    buyerRated,
    sellerRated,
    ratingGiven,
    lastPing,
    pingCount,
    dialogNotes,
    dialogConfirmed,
    flaggedForReview,
    escrowLocked,
    escrowReleasedAt
  };
}

module.exports = {
  TRANSACTION_TABLE_NAME,
  createTransactionItem
};
