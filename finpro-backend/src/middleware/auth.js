const { verifyToken } = require('../utils/jwt');
const { AppError } = require('../utils/AppError');

/**
 * Reads "Authorization: Bearer <token>", verifies it, and attaches the
 * decoded payload to req.auth as { id, role, email }. Does NOT reject
 * requests with no token — use requireAuth() or requireRole() after this
 * for routes that actually need to be protected. This lets public routes
 * (e.g. the firms marketplace) still know who's asking, when known,
 * without forcing a login.
 */
function attachAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const [scheme, token] = header.split(' ');
  if (scheme === 'Bearer' && token) {
    try {
      req.auth = verifyToken(token);
    } catch (err) {
      // Invalid/expired token: treat as anonymous rather than erroring here.
      // Routes that require auth will reject via requireAuth().
      req.auth = null;
    }
  } else {
    req.auth = null;
  }
  next();
}

/** Rejects the request unless attachAuth found a valid token. */
function requireAuth(req, res, next) {
  if (!req.auth) {
    throw new AppError(401, 'Sign in required.');
  }
  next();
}

/**
 * Rejects the request unless the authenticated account's role is one of
 * `roles`. Always call after attachAuth (and typically after requireAuth).
 * Usage: requireRole('admin') or requireRole('client', 'professional')
 */
function requireRole(...roles) {
  return function roleGate(req, res, next) {
    if (!req.auth) {
      throw new AppError(401, 'Sign in required.');
    }
    if (!roles.includes(req.auth.role)) {
      throw new AppError(403, 'You do not have access to this resource.');
    }
    next();
  };
}

module.exports = { attachAuth, requireAuth, requireRole };
