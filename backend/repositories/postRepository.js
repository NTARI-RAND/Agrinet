const crypto = require('crypto');
const pool = require('../lib/db');

// mysql2 may return JSON columns as strings; parse defensively on the way out.
function rowOut(r) {
  if (!r) return r;
  for (const k of ['media', 'payload']) {
    if (typeof r[k] === 'string') {
      try { r[k] = JSON.parse(r[k]); } catch { /* leave as-is */ }
    }
  }
  return r;
}

async function getById(id) {
  const [rows] = await pool.query('SELECT * FROM posts WHERE id = ?', [id]);
  return rowOut(rows[0]);
}

async function create(userId, data) {
  const id = crypto.randomUUID();
  await pool.query(
    `INSERT INTO posts
       (id, user_id, post_type, title, description, category, unit, price,
        quantity_available, city, state, latitude, longitude, location, media, terms,
        status, moderation_status, payload)
     VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?, 'active', 'approved', ?)`,
    [
      id, userId, data.post_type, data.title, data.description || '', data.category || null,
      data.unit || null, data.price ?? null, data.quantity_available ?? null,
      data.city || null, data.state ? String(data.state).toUpperCase().slice(0, 2) : null,
      data.latitude ?? null, data.longitude ?? null, data.location || null,
      JSON.stringify(data.media || []), data.terms || null,
      JSON.stringify(data.payload || {}),
    ]
  );
  return getById(id);
}

// The General Broadcast filter (§4.5.2): by type / category / location / price.
async function list(filters = {}) {
  let sql = `SELECT * FROM posts WHERE moderation_status = 'approved'`;
  const params = [];

  if (filters.status) { sql += ' AND status = ?'; params.push(filters.status); }
  else { sql += " AND status = 'active'"; }
  if (filters.post_type) { sql += ' AND post_type = ?'; params.push(filters.post_type); }
  if (filters.category) { sql += ' AND category = ?'; params.push(filters.category); }
  if (filters.state) { sql += ' AND state = ?'; params.push(filters.state); }
  if (filters.city) { sql += ' AND city LIKE ?'; params.push(`%${filters.city}%`); }
  if (filters.user_id) { sql += ' AND user_id = ?'; params.push(filters.user_id); }
  if (filters.minPrice) { sql += ' AND price >= ?'; params.push(Number(filters.minPrice)); }
  if (filters.maxPrice) { sql += ' AND price <= ?'; params.push(Number(filters.maxPrice)); }
  if (filters.search) { sql += ' AND (title LIKE ? OR city LIKE ?)'; params.push(`%${filters.search}%`, `%${filters.search}%`); }

  const order = { recent: 'created_at DESC', price_asc: 'price ASC', price_desc: 'price DESC' }[filters.sort] || 'created_at DESC';
  sql += ` ORDER BY ${order} LIMIT ? OFFSET ?`;
  params.push(Number(filters.limit) || 40, Number(filters.offset) || 0);

  const [rows] = await pool.query(sql, params);
  return rows.map(rowOut);
}

async function update(id, fields) {
  const allowed = ['title', 'description', 'category', 'unit', 'price', 'quantity_available', 'city', 'state', 'latitude', 'longitude', 'location', 'status'];
  const sets = [];
  const params = [];
  for (const k of allowed) {
    if (fields[k] !== undefined) { sets.push(`${k} = ?`); params.push(fields[k]); }
  }
  if (fields.media !== undefined) { sets.push('media = ?'); params.push(JSON.stringify(fields.media)); }
  if (fields.payload !== undefined) { sets.push('payload = ?'); params.push(JSON.stringify(fields.payload)); }
  if (!sets.length) return getById(id);
  params.push(id);
  await pool.query(`UPDATE posts SET ${sets.join(', ')} WHERE id = ?`, params);
  return getById(id);
}

async function softDelete(id) {
  await pool.query(`UPDATE posts SET status = 'deleted' WHERE id = ?`, [id]);
}

module.exports = { getById, create, list, update, softDelete };
