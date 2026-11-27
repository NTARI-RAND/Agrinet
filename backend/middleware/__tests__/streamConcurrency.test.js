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

  test('a disconnect during Redis acquisition releases the late reservation without opening a stream', async () => {
    let resume;
    let started;
    const acquiring = new Promise(resolve => { started = resolve; });
    const paused = new Promise(resolve => { resume = resolve; });
    const active = new Set();
    let firstAcquire = true;
    // Redis is the external boundary; the real reservation middleware runs unchanged.
    const redis = { eval: async (script, _count, _key, ...args) => {
      if (script.includes('ZADD')) {
        if (firstAcquire) { firstAcquire = false; started(); await paused; }
        if (active.size >= args[1]) return 0;
        active.add(args[3]);
      } else active.delete(args[0]);
      return 1;
    } };
    let createLimit;
    jest.isolateModules(() => {
      jest.doMock('../rateLimit', () => ({ getRedisClient: () => redis }));
      createLimit = require('../streamConcurrency').createConcurrentStreamLimit;
    });
    const limit = createLimit({ maximum: 1 });
    const req = { user: { userId: 'late-reservation', exp: Math.ceil(Date.now() / 1000) + 60 } };
    const first = response();
    const second = response();
    let opened = false;
    const pending = limit(req, first, () => { opened = true; });
    try {
      await acquiring;
      first.destroyed = true;
      first.emit('close');
      resume();
      await pending;
      expect(opened).toBe(false);
      let replacementOpened = false;
      await limit(req, second, () => { replacementOpened = true; });
      expect(replacementOpened).toBe(true);
    } finally {
      resume();
      await pending;
      first.emit('close');
      second.emit('close');
      jest.dontMock('../rateLimit');
    }
  });
});
