const NOTIFICATION_TABLE_NAME = "Notifications";

function createNotificationItem({
  userId,
  notificationId,
  message,
  read = false,
  createdAt = new Date().toISOString()
}) {
  return {
    userId,         // Partition key for Notifications table
    notificationId, // Sort key for Notifications table
    message,
    read,
    createdAt
  };
}

module.exports = {
  NOTIFICATION_TABLE_NAME,
  createNotificationItem
};
