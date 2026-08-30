/* eslint-disable no-unused-vars */
const { Prisma } = require('@prisma/client');

/**
 * Central error handler. Registered last in index.js so every thrown error
 * (including ones forwarded by asyncHandler) ends up here with a
 * consistent { error: message } response instead of leaking internals.
 */
function errorHandler(err, req, res, next) {
  // Our own thrown errors (AppError) already carry the right status code.
  if (err.isAppError) {
    return res.status(err.statusCode).json({ error: err.message });
  }

  // Common Prisma errors get translated to sane HTTP statuses instead of a 500.
  if (err instanceof Prisma.PrismaClientKnownRequestError) {
    if (err.code === 'P2002') {
      return res.status(409).json({ error: 'That value is already in use.' });
    }
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Not found.' });
    }
  }

  if (err.name === 'JsonWebTokenError' || err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Session expired. Please sign in again.' });
  }

  // Anything unexpected: log the real error server-side, never leak it to the client.
  console.error(err);
  return res.status(500).json({ error: 'Something went wrong on our end.' });
}

module.exports = { errorHandler };
