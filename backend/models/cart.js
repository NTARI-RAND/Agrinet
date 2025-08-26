const carts = {};

function getCart(userId) {
  if (!carts[userId]) carts[userId] = [];
  return carts[userId];
}

function addItem(userId, item) {
  const cart = getCart(userId);
  cart.push(item);
}

function removeItem(userId, itemId) {
  const cart = getCart(userId);
  const index = cart.findIndex(i => String(i.id) === String(itemId));
  if (index !== -1) cart.splice(index, 1);
}

function clearCart(userId) {
  carts[userId] = [];
}

module.exports = { getCart, addItem, removeItem, clearCart };
