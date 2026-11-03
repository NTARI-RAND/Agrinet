const { EventEmitter } = require('node:events');
const { createConcurrentStreamLimit } = require('../streamConcurrency');

function response() {
  const res = new EventEmitter();
  res.statusCode = 200;
  res.status = code => { res.statusCode = code; return res; };
  res.json = body => { res.body = body; return res; };
  return res;
}

describe('concurrent stream limits', () => {
  test('caps open streams per account and releases a slot on disconnect', async () => {
    const middleware = createConcurrentStreamLimit({ maximum: 1 });
    const req = { user: { userId: 'stream-user', exp: Math.ceil(Date.now() / 1000) + 60 } };
    const first = response();
    let firstNext = false;
    await middleware(req, first, () => { firstNext = true; });
    expect(firstNext).toBe(true);

    const second = response();
    let secondNext = false;
    await middleware(req, second, () => { secondNext = true; });
    expect(secondNext).toBe(false);
    expect(second.statusCode).toBe(429);

    first.emit('close');
    await new Promise(resolve => setImmediate(resolve));

    const third = response();
    let thirdNext = false;
    await middleware(req, third, () => { thirdNext = true; });
    expect(thirdNext).toBe(true);
    third.emit('close');
  });

  test('fails closed without a valid account and unexpired token', async () => {
    const middleware = createConcurrentStreamLimit();
    const res = response();
    await middleware({ user: { userId: 'missing-exp' } }, res, () => { throw new Error('next must not run'); });
    expect(res.statusCode).toBe(401);
  });
});
