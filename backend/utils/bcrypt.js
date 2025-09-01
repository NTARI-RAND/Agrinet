let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch {
  try {
    bcrypt = require('bcrypt');
  } catch {
    const crypto = require('crypto');
    bcrypt = {
      async hash(password, _saltRounds) {
        return crypto.createHash('sha256').update(password).digest('hex');
      },
      async compare(password, hashed) {
        const digest = crypto.createHash('sha256').update(password).digest('hex');
        return digest === hashed;
      }
    };
  }
}
module.exports = bcrypt;
