const { AppError } = require('./AppError');

function normEmail(email) {
  return (email || '').toString().trim().toLowerCase();
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function isValidEmail(email) {
  return EMAIL_RE.test(email);
}

/**
 * Throws a 400 listing any of `fields` that are missing/blank on `body`.
 * Usage: requireFields(req.body, ['email', 'password', 'name']);
 */
function requireFields(body, fields) {
  const missing = fields.filter((f) => {
    const v = body[f];
    return v === undefined || v === null || (typeof v === 'string' && v.trim() === '');
  });
  if (missing.length) {
    throw new AppError(400, `Missing required field(s): ${missing.join(', ')}`);
  }
}

function requireEmail(email) {
  const normalized = normEmail(email);
  if (!isValidEmail(normalized)) {
    throw new AppError(400, 'Enter a valid email address.');
  }
  return normalized;
}

function requirePassword(password, minLength = 8) {
  if (!password || password.length < minLength) {
    throw new AppError(400, `Password must be at least ${minLength} characters.`);
  }
}

module.exports = { normEmail, isValidEmail, requireFields, requireEmail, requirePassword };
