const subscriptions = [];
let currentId = 1;

function createSubscription(userId, boxType, frequency) {
  const subscription = { id: currentId++, userId, boxType, frequency };
  subscriptions.push(subscription);
  return subscription;
}

function listSubscriptions(userId) {
  return subscriptions.filter(s => s.userId === userId);
}

module.exports = { createSubscription, listSubscriptions };
