/**
 * Wraps an async Express route handler so any rejected promise / thrown
 * error is forwarded to next(), where the central error handler deals
 * with it — instead of every route needing its own try/catch.
 */
function asyncHandler(fn) {
  return function wrapped(req, res, next) {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

module.exports = { asyncHandler };
