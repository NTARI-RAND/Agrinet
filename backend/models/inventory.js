// DynamoDB helper for inventory items

const INVENTORY_TABLE_NAME = "Inventory";

function createInventoryItem({
  id,
  name,
  category, // 'fresh' or 'processed'
  stock = 0,
  unit,
  seasons = [],
  price = 0,
  batch = null,
  lot = null,
  externalId = null,
  createdAt = new Date().toISOString(),
  updatedAt = new Date().toISOString()
}) {
  return {
    id,
    name,
    category,
    stock,
    unit,
    seasons,
    price,
    batch,
    lot,
    externalId,
    createdAt,
    updatedAt
  };
}

module.exports = {
  INVENTORY_TABLE_NAME,
  createInventoryItem
};
