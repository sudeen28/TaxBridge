const express = require('express');
const prisma = require('../db');
const { verifyPassword } = require('../utils/password');
const { signToken } = require('../utils/jwt');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields, requireEmail } = require('../utils/validate');
const { publicAccount } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

// Intentionally no POST /signup here — admin accounts are provisioned via
// `npm run seed` (see prisma/seed.js), never through a public endpoint.
// This replaces the frontend prototype's hardcoded client-side passcode.

// POST /api/auth/admin/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = requireEmail(req.body.email);

    const admin = await prisma.admin.findUnique({ where: { email } });
    if (!admin) {
      throw new AppError(401, 'Incorrect email or password.');
    }
    const ok = await verifyPassword(req.body.password, admin.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Incorrect email or password.');
    }

    const token = signToken({ id: admin.id, role: 'admin', email: admin.email });
    res.json({ token, admin: publicAccount(admin) });
  })
);

// GET /api/auth/admin/me
router.get(
  '/me',
  requireAuth,
  requireRole('admin'),
  asyncHandler(async (req, res) => {
    const admin = await prisma.admin.findUnique({ where: { id: req.auth.id } });
    if (!admin) throw new AppError(404, 'Admin account not found.');
    res.json({ admin: publicAccount(admin) });
  })
);

module.exports = router;
