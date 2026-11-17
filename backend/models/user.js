// DynamoDB user record helpers and explicit response contracts.
const USER_TABLE_NAME = 'Users';

function createUserItem({
  id, username, email, phone, password, verified = false,
  verificationCode, location, coordinates, locationType,
  locationPrivacy = false, role = 'consumer', reputationScore = 0,
  reputationWeight = 0
}) {
  const item = {
    id, username, email, phone, password, verified, location,
    locationPrivacy, role, reputationScore, reputationWeight
  };
  if (verificationCode !== undefined) item.verificationCode = verificationCode;
  if (coordinates !== undefined) item.coordinates = coordinates;
  if (locationType !== undefined) item.locationType = locationType;
  return item;
}

// Public directory DTO: no contact details, roles, precise location, or auth state.
function sanitizeUserForPublic(user = {}) {
  const safe = {};
  for (const field of ['id', 'username', 'locationType', 'reputationScore', 'reputationWeight']) {
    if (user[field] !== undefined) safe[field] = user[field];
  }
  return safe;
}

// Authenticated account DTO. Only returned to the account owner at login.
function sanitizeUserForAuth(user = {}) {
  const safe = {};
  for (const field of ['id', 'username', 'email', 'phone', 'role', 'verified', 'reputationScore', 'reputationWeight']) {
    if (user[field] !== undefined) safe[field] = user[field];
  }
  return safe;
}

// Administrator DTO intentionally excludes credentials, verification codes and exact coordinates.
function sanitizeUserForAdmin(user = {}) {
  const safe = {};
  for (const field of ['id', 'username', 'email', 'phone', 'role', 'verified', 'locationType', 'reputationScore', 'reputationWeight', 'createdAt']) {
    if (user[field] !== undefined) safe[field] = user[field];
  }
  return safe;
}

module.exports = {
  USER_TABLE_NAME,
  createUserItem,
  sanitizeUserForPublic,
  sanitizeUserForAuth,
  sanitizeUserForAdmin
};
