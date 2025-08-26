const LISTINGS_TABLE_NAME = "Listings";

function createListingItem({
  id,
  userId,
  type,
  title,
  category,
  description,
  price,
  location,
  media = [],
  logisticsRange,
  processingCategory,
  compostingService,
  availability = [],
  tags = [],
  createdAt = new Date().toISOString()
}) {
  return {
    id,
    userId,
    type,
    title,
    category,
    description,
    price,
    location,
    media,
    logisticsRange,
    processingCategory,
    compostingService,
    availability,
    tags,
    createdAt
  };
}

module.exports = {
  LISTINGS_TABLE_NAME,
  createListingItem
};
