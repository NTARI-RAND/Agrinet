const LISTINGS_TABLE_NAME = "Listings";

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
    id,
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
  LISTINGS_TABLE_NAME,
  createListingItem
};
