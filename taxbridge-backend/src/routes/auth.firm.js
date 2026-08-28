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

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

// POST /api/auth/firm/signup
router.post(
  '/signup',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['firmName', 'email', 'password']);
    const email = requireEmail(req.body.email);
    requirePassword(req.body.password);

    const existing = await prisma.firm.findUnique({ where: { email } });
    if (existing) {
      throw new AppError(409, 'A firm account with that email already exists.');
    }

    const passwordHash = await hashPassword(req.body.password);
    const firm = await prisma.firm.create({
      data: {
        email,
        passwordHash,
        firmName: req.body.firmName.trim(),
        phone: req.body.phone ? req.body.phone.trim() : null,
        logoInitials: req.body.logoInitials ? req.body.logoInitials.trim() : null,
        website: req.body.website ? req.body.website.trim() : null,
        yearEstablished: req.body.yearEstablished ? String(req.body.yearEstablished).trim() : null,

        headquarters: req.body.headquarters ? req.body.headquarters.trim() : null,
        citiesServed: toStringArray(req.body.citiesServed),
        statesServed: toStringArray(req.body.statesServed),
        countriesServed: toStringArray(req.body.countriesServed),
        remoteAvailable: Boolean(req.body.remoteAvailable),

        description: req.body.description ? req.body.description.trim() : null,

        credentialIcan: req.body.credentials?.ican ? String(req.body.credentials.ican).trim() : null,
        credentialAnan: req.body.credentials?.anan ? String(req.body.credentials.anan).trim() : null,
        credentialCitn: req.body.credentials?.citn ? String(req.body.credentials.citn).trim() : null,
        credentialOther: req.body.credentials?.other ? String(req.body.credentials.other).trim() : null,
        verificationDocs: req.body.credentials?.verificationDocs
          ? String(req.body.credentials.verificationDocs).trim()
          : null,

        specialisations: toStringArray(req.body.specialisations),
        industries: toStringArray(req.body.industries),

        capacity: 'SMALL',
        availability: 'ACCEPTING',
        verificationStatus: 'PENDING',
      },
    });

    const token = signToken({ id: firm.id, role: 'firm', email: firm.email });
    res.status(201).json({ token, firm: publicAccount(firm) });
  })
);

// POST /api/auth/firm/login
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['email', 'password']);
    const email = requireEmail(req.body.email);

    const firm = await prisma.firm.findUnique({ where: { email } });
    if (!firm) {
      throw new AppError(401, 'No firm account found for that email.');
    }
    const ok = await verifyPassword(req.body.password, firm.passwordHash);
    if (!ok) {
      throw new AppError(401, 'Incorrect password.');
    }

    const token = signToken({ id: firm.id, role: 'firm', email: firm.email });
    res.json({ token, firm: publicAccount(firm) });
  })
);

// GET /api/auth/firm/me
router.get(
  '/me',
  requireAuth,
  requireRole('firm'),
  asyncHandler(async (req, res) => {
    const firm = await prisma.firm.findUnique({ where: { id: req.auth.id } });
    if (!firm) throw new AppError(404, 'Firm account not found.');
    res.json({ firm: publicAccount(firm) });
  })
);

module.exports = router;
