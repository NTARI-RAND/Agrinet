const BROADCAST_TABLE_NAME = "Broadcasts";

function createBroadcastItem({
  id,
  userId,
  title,
  message,
  geolocation,
  createdAt = new Date().toISOString()
}) {
  return {
    id,
    userId,
    title,
    message,
    geolocation,
    createdAt
  };
}

module.exports = {
  BROADCAST_TABLE_NAME,
  createBroadcastItem
};
