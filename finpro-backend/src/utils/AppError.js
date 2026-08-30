/**
 * Throw this anywhere in a route handler to send a clean, consistent
 * { error: message } response with the right status code, instead of
 * leaking a stack trace or an inconsistent ad-hoc shape.
 *
 * Example: throw new AppError(404, 'Engagement not found');
 */
class AppError extends Error {
  constructor(statusCode, message) {
    super(message);
    this.statusCode = statusCode;
    this.isAppError = true;
  }
}

module.exports = { AppError };
