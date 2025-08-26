const Cart = require('../models/cart');
const Order = require('../models/order');

exports.checkout = (req, res) => {
  const { userId } = req.params;
  const items = Cart.getCart(userId);
  if (items.length === 0) {
    return res.status(400).json({ error: 'Cart is empty' });
  }
  const order = Order.createOrder(userId, items, req.body);
  Cart.clearCart(userId);
  res.status(201).json(order);
};

exports.listOrders = (req, res) => {
  const { userId } = req.params;
  const orders = Order.listOrders(userId);
  res.json(orders);
};
