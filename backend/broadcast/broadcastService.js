const subscriberManager = require('./subscriberManager');
const { translate } = require('./translationService');

class BroadcastService {
  constructor() {
    this.queue = [];
    this.history = [];
  }

  broadcast(message) {
    const msg = { priority: 0, ...message };
    this.queue.push(msg);
    // prioritize: higher priority first
    this.queue.sort((a, b) => b.priority - a.priority);
    const next = this.queue.shift();
    const deliveries = [];
    subscriberManager.subscribers.forEach((prefs, id) => {
      const lang = prefs.language || 'en';
      const translated = translate(next.content, lang);
      deliveries.push({ subscriber: id, content: translated });
    });
    const record = { message: next, deliveries };
    this.history.push(record);
    return record;
  }
}

module.exports = new BroadcastService();
