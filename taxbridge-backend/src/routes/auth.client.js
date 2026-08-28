const express = require('express');
const prisma = require('../db');
const { hashPassword, verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields, requireEmail, requirePassword } = require('../utils/validate');
const { publicAccount } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');

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
