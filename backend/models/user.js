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
  reputationScore = 0
}) {
  return {
    id, // Partition key for DynamoDB table
    username,
    email,
    phone,
    password,
    verified,
    verificationCode,
    location,
    coordinates,
    locationType,
    locationPrivacy,
    role,
    reputationScore
  };
}

module.exports = {
  USER_TABLE_NAME,
  createUserItem
};
