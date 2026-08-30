const express = require('express');
const crypto = require('crypto');
const prisma = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields, requireEmail, requirePassword } = require('../utils/validate');
const { publicAccount } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { verifyGoogleAccessToken } = require('../utils/googleAuth');

const router = express.Router();

// POST /api/auth/client/signup
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password']);
    const email = requireEmail(req.body.email);
    requirePassword(req.body.password);

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'An account with that email already exists.');
    }

    const passwordHash = await hashPassword(req.body.password);
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'CLIENT',
        name: req.body.name.trim(),
        phone: req.body.phone ? req.body.phone.trim() : null,
      },
    });

    const token = signToken({ id: user.id, role: 'client', email: user.email });
    res.status(201).json({ token, user: publicAccount(user) });
  })
);

// POST /api/auth/client/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = requireEmail(req.body.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'CLIENT') {
      throw new AppError(401, 'No client account found for that email.');
    }
    const ok = await verifyPassword(req.body.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Incorrect password.');
    }

    const token = signToken({ id: user.id, role: 'client', email: user.email });
    res.json({ token, user: publicAccount(user) });
  })
);

/**
 * POST /api/auth/client/google — body: { accessToken }
 * Logs in an existing client account, links Google to an existing
 * email/password account (only when Google reports the email verified),
 * or creates a brand-new client account — same response shape as
 * /login and /signup, so the frontend treats all three identically.
 */
router.post(
  '/google',
  asyncHandler(async (req, res) => {
    const g = await verifyGoogleAccessToken(req.body.accessToken);

    let user = await prisma.user.findUnique({ where: { email: g.email } });

    if (user && user.role !== 'CLIENT') {
      throw new AppError(409, 'This email is already registered as a different account type.');
    }

    if (!user) {
      // Google accounts have no password — store an unguessable random
      // hash so the column stays non-null without ever being usable for
      // an actual email/password login.
      const passwordHash = await hashPassword(crypto.randomBytes(32).toString('hex'));
      user = await prisma.user.create({
        data: {
          email: g.email,
          passwordHash,
          role: 'CLIENT',
          name: g.name,
          googleId: g.googleId,
        },
      });
    } else if (!user.googleId && g.emailVerified) {
      user = await prisma.user.update({ where: { id: user.id }, data: { googleId: g.googleId } });
    }

    const token = signToken({ id: user.id, role: 'client', email: user.email });
    res.json({ token, user: publicAccount(user) });
  })
);

// GET /api/auth/client/me
router.get(
  '/me',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth.id } });
    if (!user) throw new AppError(404, 'Account not found.');
    res.json({ user: publicAccount(user) });
  })
);

module.exports = router;