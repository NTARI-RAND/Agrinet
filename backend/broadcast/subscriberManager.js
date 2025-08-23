class SubscriberManager {
  constructor() {
    this.subscribers = new Map();
  }

  addSubscriber(id, preferences = {}) {
    this.subscribers.set(id, preferences);
  }

  removeSubscriber(id) {
    this.subscribers.delete(id);
  }

  listSubscribers() {
    return Array.from(this.subscribers.entries()).map(([id, prefs]) => ({ id, ...prefs }));
  }
}

module.exports = new SubscriberManager();
