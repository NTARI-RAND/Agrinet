// Whitepaper §4.5.3 post taxonomy. Type-specific fields live in the post's JSON
// `payload`; this module enumerates the types and does light validation. The
// Fruitful forms enforce the detailed per-type field sets.

const POST_TYPES = [
  'service',        // §4.5.3.1  labor / logistics / processing / composting / environmental
  'agrotourism',    // §4.5.3.2  market garden / event (entertainment/education/volunteering/community/tour)
  'direct_market',  // §4.5.3.3  harvested goods for immediate sale
  'plan_consumer',  // §4.5.3.4.1
  'plan_producer',  // §4.5.3.4.2
  'product',        // §4.5.3.5  value-added / seeds-young / tools / infrastructure / soil input
];

const USE_CATEGORIES = ['food', 'pharmaceutical', 'fiber', 'chemical', 'mineral', 'ornamental'];

// Service top-level category codes (§4.5.3.1).
const SERVICE_CATEGORIES = ['la', 'lr', 'pr', 'cr', 'es'];

function validate(postType, body = {}) {
  const errors = [];
  if (!POST_TYPES.includes(postType)) {
    errors.push(`post_type must be one of: ${POST_TYPES.join(', ')}`);
  }
  if (!body.title || !String(body.title).trim()) {
    errors.push('title is required');
  }

  const payload = (body.payload && typeof body.payload === 'object' && !Array.isArray(body.payload))
    ? { ...body.payload }
    : {};

  if (postType === 'service' && body.category && !SERVICE_CATEGORIES.includes(body.category)) {
    errors.push(`service category must be one of: ${SERVICE_CATEGORIES.join(', ')}`);
  }
  if ((postType === 'direct_market' || postType === 'product') && body.price == null) {
    errors.push('price is required for direct_market and product posts');
  }
  if (payload.use_category != null && !USE_CATEGORIES.includes(payload.use_category)) {
    errors.push(`use_category must be one of: ${USE_CATEGORIES.join(', ')}`);
  }

  return { ok: errors.length === 0, errors, payload };
}

module.exports = { POST_TYPES, USE_CATEGORIES, SERVICE_CATEGORIES, validate };
