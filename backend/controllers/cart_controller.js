const Cart = require('../models/cart');

exports.getCart = (req, res) => {
  const { userId } = req.params;
  const cart = Cart.getCart(userId);
  res.json(cart);
};

exports.addItem = (req, res) => {
  const { userId } = req.params;
  Cart.addItem(userId, req.body);
  res.status(201).json({ message: 'Item added to cart' });
};

exports.removeItem = (req, res) => {
  const { userId, itemId } = req.params;
  Cart.removeItem(userId, itemId);
  res.json({ message: 'Item removed' });
};

exports.clearCart = (req, res) => {
  const { userId } = req.params;
  Cart.clearCart(userId);
  res.json({ message: 'Cart cleared' });
};
