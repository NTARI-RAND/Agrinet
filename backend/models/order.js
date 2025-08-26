const orders = [];
let currentId = 1;

function createOrder(userId, items, { deliveryMethod, pickupTime, deliveryAddress }) {
  const order = {
    id: currentId++,
    userId,
    items,
    status: 'pending',
    deliveryMethod: deliveryMethod || 'pickup',
    pickupTime: pickupTime || null,
    deliveryAddress: deliveryAddress || null
  };
  orders.push(order);
  return order;
}

function listOrders(userId) {
  return orders.filter(o => o.userId === userId);
}

module.exports = { createOrder, listOrders };
