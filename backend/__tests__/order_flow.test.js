const cartController = require('../controllers/cart_controller');
const orderController = require('../controllers/order_controller');
const { createRes } = require('./testUtils');

test('checkout creates order and clears cart', () => {
  const reqAdd = { params: { userId: 'u1' }, body: { id: 1, name: 'Apple' } };
  const resAdd = createRes();
  cartController.addItem(reqAdd, resAdd);

  const reqCheckout = {
    params: { userId: 'u1' },
    body: { deliveryMethod: 'pickup', pickupTime: '2024-01-01T10:00:00Z' }
  };
  const resCheckout = createRes();
  orderController.checkout(reqCheckout, resCheckout);

  expect(resCheckout.statusCode).toBe(201);
  expect(resCheckout.body.items).toHaveLength(1);

  const reqCart = { params: { userId: 'u1' } };
  const resCart = createRes();
  cartController.getCart(reqCart, resCart);
  expect(resCart.body).toHaveLength(0);
});
