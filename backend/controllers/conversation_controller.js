const { randomUUID } = require('crypto');
const pool = require('../lib/db');
const { conversationsCreatedTotal } = require('../lib/metrics');
// const Conversation = require('../models/conversation');

exports.create = async (req, res) => {
  const buyerId = req.user.id;
  // Messaging is always anchored to a post (of any type). Accept post_id; fall back
  // to listing_id for older callers (a shimmed listing shares its id in posts).
  const postId = req.body.post_id || req.body.listing_id;

  if (!postId || typeof postId !== "string") {
    return res.status(400).json({ error: "post_id is required" });
  }

  const connection = await pool.getConnection();

  try {
    const [postRows] = await connection.query(
      `SELECT id, user_id, title FROM posts WHERE id = ?`,
      [postId]
    );

    const post = postRows[0];

    if (!post) {
      return res.status(404).json({ error: "Post not found" });
    }

    const sellerId = post.user_id;

    if (sellerId === buyerId) {
      return res.status(400).json({ error: "You cannot message your own post" });
    }

    const [existing] = await connection.query(
      `
      SELECT id
      FROM conversations
      WHERE post_id = ?
        AND buyer_id = ?
        AND seller_id = ?
      `,
      [postId, buyerId, sellerId]
    );

    if (existing.length) {
      return res.json({
        id: existing[0].id,
        post_id: postId,
        buyer_id: buyerId,
        seller_id: sellerId
      });
    }

    const id = randomUUID();

    await connection.query(
      `INSERT INTO conversations (id, post_id, buyer_id, seller_id, name)
       VALUES (?, ?, ?, ?, ?)`,
      [id, postId, buyerId, sellerId, post.title || null]
    );

    conversationsCreatedTotal.inc();

    return res.status(201).json({
      id,
      post_id: postId,
      buyer_id: buyerId,
      seller_id: sellerId
    });
  } finally {
    connection.release();
  }
};

exports.list = async (req, res) => {

  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM conversations
    WHERE buyer_id = ?
       OR seller_id = ?
    ORDER BY created_at DESC
    `,
    [userId, userId]
  );

  res.json(rows);
};

exports.get = async (req, res) => {

  const { id } = req.params;
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM conversations
    WHERE id = ?
      AND (buyer_id = ? OR seller_id = ?)
    `,
    [id, userId, userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await pool.query(
    `
    UPDATE messages
    SET delivery_status = 'read'
    WHERE conversation_id = ?
    AND sender_id != ?
    `,
    [id, req.user.id]
  );

  const [messages] = await pool.query(
    `
    SELECT id, sender_id, message, created_at
    FROM messages
    WHERE conversation_id = ?
    ORDER BY created_at ASC
    `,
    [id]
  );

  res.json({
    conversation: rows[0],
    messages
  });

};

exports.rename = async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM conversations
    WHERE id = ?
      AND (buyer_id = ? OR seller_id = ?)
    `,
    [id, userId, userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await pool.query(
    `UPDATE conversations SET name = ? WHERE id = ?`,
    [name, id]
  );

  res.json({ message: "Conversation renamed" });
};

exports.remove = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM conversations
    WHERE id = ?
      AND (buyer_id = ? OR seller_id = ?)
    `,
    [id, userId, userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await pool.query(
    `DELETE FROM conversations WHERE id = ?`,
    [id]
  );

  res.json({ message: "Conversation removed" });
};

exports.pin = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  const [rows] = await pool.query(
    `
    SELECT *
    FROM conversations
    WHERE id = ?
      AND (buyer_id = ? OR seller_id = ?)
    `,
    [id, userId, userId]
  );

  if (!rows.length) {
    return res.status(404).json({ error: "Conversation not found" });
  }

  await pool.query(
    `UPDATE conversations SET pinned = 1 WHERE id = ?`,
    [id]
  );

  res.json({ message: "Conversation pinned" });
};
