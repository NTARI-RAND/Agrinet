// DynamoDB does not require a schema or model definition like Mongoose.
// Instead, you can use this file to define helper functions for user objects,
// or simply export attribute names for consistency across your codebase.

const USER_TABLE_NAME = "Users";

function createUserItem({
  id, // You should generate a unique id for each user (e.g., uuid)
  name,
  email,
  phone,
  password,
  verified = false,
  location,
  role = "consumer",
  reputationScore = 0,
  certificationDocs = [],
  contractAgreement = false,
  verificationCode = null
}) {
  return {
    id, // Partition key for DynamoDB table
    name,
    email,
    phone,
    password,
    verified,
    location,
    role,
    reputationScore,
    certificationDocs,
    contractAgreement,
    verificationCode
  };
}

module.exports = {
  USER_TABLE_NAME,
  createUserItem
};
