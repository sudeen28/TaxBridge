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

// POST /api/auth/professional/signup
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'email', 'password', 'professionalBody', 'registrationNumber', 'expertise']);
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
        role: 'PROFESSIONAL',
        name: req.body.name.trim(),
        phone: req.body.phone ? req.body.phone.trim() : null,
        professionalBody: req.body.professionalBody.trim(),
        registrationNumber: req.body.registrationNumber.trim(),
        yearsExperience: req.body.yearsExperience ? String(req.body.yearsExperience).trim() : null,
        expertise: req.body.expertise.trim(),
        rate: req.body.rate ? req.body.rate.trim() : null,
        bio: req.body.bio ? req.body.bio.trim() : null,
        verified: false, // always starts unverified — admin reviews before they receive leads
      },
    });

    const token = signToken({ id: user.id, role: 'professional', email: user.email });
    res.status(201).json({ token, user: publicAccount(user) });
  })
);

// POST /api/auth/professional/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = requireEmail(req.body.email);

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user || user.role !== 'PROFESSIONAL') {
      throw new AppError(401, 'No professional account found for that email.');
    }
    const ok = await verifyPassword(req.body.password, user.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Incorrect password.');
    }

    const token = signToken({ id: user.id, role: 'professional', email: user.email });
    res.json({ token, user: publicAccount(user) });
  })
);

// GET /api/auth/professional/me
router.get(
  '/me',
  requireAuth,
  requireRole('professional'),
  asyncHandler(async (req, res) => {
    const user = await prisma.user.findUnique({ where: { id: req.auth.id } });
    if (!user) throw new AppError(404, 'Account not found.');
    res.json({ user: publicAccount(user) });
  })
);

module.exports = router;
