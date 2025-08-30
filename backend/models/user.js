// DynamoDB does not require a schema or model definition like Mongoose.
// Instead, you can use this file to define helper functions for user objects,
// or simply export attribute names for consistency across your codebase.

const USER_TABLE_NAME = "Users";

function createUserItem({
  id, // You should generate a unique id for each user (e.g., uuid)
  username,
  email,
  phone,
  password,
  verified = false,
  verificationCode,
  location,
  coordinates, // { lat, long }
  locationType, // 'farm' | 'production' | 'delivery'
  locationPrivacy = false,
  role = "consumer",
  reputationScore = 0,
  reputationWeight = 0
}) {
  const item = {
    id, // Partition key for DynamoDB table
    username,
    email,
    phone,
    password,
    verified,
    location,
    locationPrivacy,
    role,
    reputationScore,
    reputationWeight
  };

  if (verificationCode !== undefined) item.verificationCode = verificationCode;
  if (coordinates !== undefined) item.coordinates = coordinates;
  if (locationType !== undefined) item.locationType = locationType;

  return item;
}

module.exports = {
  USER_TABLE_NAME,
  createUserItem
};
