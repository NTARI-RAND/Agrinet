const Subscription = require('../models/subscription');

exports.createSubscription = (req, res) => {
  const { userId, boxType, frequency } = req.body;
  const subscription = Subscription.createSubscription(userId, boxType, frequency);
  res.status(201).json(subscription);
};

exports.listSubscriptions = (req, res) => {
  const { userId } = req.params;
  const subs = Subscription.listSubscriptions(userId);
  res.json(subs);
};
