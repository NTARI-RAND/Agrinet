const express = require('express');
const repo = require('../repositories/postRepository');
const { validate } = require('../services/postTypes');
const { authenticateToken, optionalAuth } = require('../middleware/authMiddleware');
const { userRateLimiter, strictWriteLimiter } = require('../middlewares/rateLimiters');
const upload = require('../middleware/uploadMiddleware');
const { uploadFile } = require('../lib/storage');

const router = express.Router();

/* ── GET /posts — the General Broadcast (§4.5.2): filter by type/category/geo/price ── */
router.get('/', optionalAuth, async (req, res) => {
  try {
    const posts = await repo.list(req.query);
    res.json({ posts, total: posts.length });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /posts/upload-media — must precede /:id ── */
router.post('/upload-media', authenticateToken, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
    const url = await uploadFile(req.file.buffer, req.file.mimetype, 'posts');
    res.json({ url });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── GET /posts/:id ── */
router.get('/:id', optionalAuth, async (req, res) => {
  try {
    const post = await repo.getById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    res.json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── POST /posts — create a typed post ── */
router.post('/', authenticateToken, userRateLimiter, strictWriteLimiter, async (req, res) => {
  try {
    const postType = req.body.post_type;
    const { ok, errors, payload } = validate(postType, req.body);
    if (!ok) return res.status(400).json({ error: errors.join('; ') });
    const post = await repo.create(req.user.id, { ...req.body, post_type: postType, payload });
    res.status(201).json(post);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── PUT /posts/:id — owner or admin ── */
router.put('/:id', authenticateToken, userRateLimiter, async (req, res) => {
  try {
    const post = await repo.getById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const updated = await repo.update(req.params.id, req.body);
    res.json(updated);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

/* ── DELETE /posts/:id — soft delete, owner or admin ── */
router.delete('/:id', authenticateToken, async (req, res) => {
  try {
    const post = await repo.getById(req.params.id);
    if (!post) return res.status(404).json({ error: 'Post not found' });
    if (post.user_id !== req.user.id && req.user.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden' });
    }
    await repo.softDelete(req.params.id);
    res.json({ success: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
