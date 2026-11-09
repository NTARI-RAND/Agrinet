const express = require('express');
const router = express.Router();
const auth = require('../middleware/chatAuth');
const ctrl = require('../controllers/conversation_controller');
const asyncHandler = require('../utils/asyncHandler');
const { rateLimit, ipKeyGenerator } = require('express-rate-limit');

router.post('/', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), asyncHandler(ctrl.create));
router.get('/', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), asyncHandler(ctrl.list));
router.put('/:id', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), asyncHandler(ctrl.rename));
router.delete('/:id', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), asyncHandler(ctrl.remove));
router.post('/:id/pin', rateLimit({
  windowMs: 60 * 1000,
  limit: 300,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many authentication attempts' }
}), auth, rateLimit({
  windowMs: 60 * 1000,
  limit: 120,
  standardHeaders: 'draft-6',
  legacyHeaders: false,
  keyGenerator: req => req.user?.userId
    ? 'account:' + req.user.userId
    : 'ip:' + ipKeyGenerator(req.ip),
  message: { error: 'Too many requests, please try again later' }
}), asyncHandler(ctrl.pin));

module.exports = router;
