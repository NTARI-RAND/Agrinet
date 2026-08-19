let bcrypt;
try {
  bcrypt = require('bcryptjs');
} catch {
  try {
    bcrypt = require('bcrypt');
  } catch {
    // No silent fallback: the previous unsalted single-round SHA-256 shim
    // made every stored password crackable at billions of guesses/second.
    // bcryptjs is a declared dependency, so this throw only fires on a
    // broken install — which must fail loudly, not degrade silently.
    throw new Error(
      "No bcrypt implementation available: install 'bcryptjs' (declared in package.json). " +
      'Refusing to fall back to a fast unsalted hash for passwords.'
    );
  }
}
module.exports = bcrypt;
