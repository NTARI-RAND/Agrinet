const subscriberManager = require('./subscriberManager');
const { translate } = require('./translationService');

class BroadcastService {
  constructor() {
    this.queue = [];
    this.history = [];
  }

  broadcast(message) {
    const msg = { priority: 0, ...message };
    // Insert msg into queue in order (higher priority first)
    let insertIdx = 0;
    while (insertIdx < this.queue.length && this.queue[insertIdx].priority >= msg.priority) {
      insertIdx++;
    }
    this.queue.splice(insertIdx, 0, msg);
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
