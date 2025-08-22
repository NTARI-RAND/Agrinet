// DynamoDB helper for marketplace listings

const LISTING_TABLE_NAME = "Listings";

function createListingItem({
  id,
  userId,
  type,
  title,
  description,
  price,
  location,
  createdAt = new Date().toISOString()
}) {
  return {
    id, // Partition key
    userId,
    type,
    title,
    description,
    price,
    location,
    createdAt
  };
}

module.exports = {
  LISTING_TABLE_NAME,
  createListingItem
};
