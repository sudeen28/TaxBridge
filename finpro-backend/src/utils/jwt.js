const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET;
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

if (!JWT_SECRET && process.env.NODE_ENV !== 'test') {
  // Fail loudly at boot rather than silently signing tokens with `undefined`.
  throw new Error('JWT_SECRET is not set. Add it to your .env file.');
}

/**
 * Sign a token for a given account.
 * @param {{ id: string, role: 'client'|'professional'|'firm'|'admin', email: string }} payload
 */
function signToken(payload) {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });
}

function verifyToken(token) {
  return jwt.verify(token, JWT_SECRET);
}

module.exports = { signToken, verifyToken };
