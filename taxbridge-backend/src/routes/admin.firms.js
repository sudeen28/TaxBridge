const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { presentFirm } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { verificationStatus: verificationStatusMap, toDbOrThrow } = require('../utils/enumMaps');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// GET /api/admin/firms — full firm list, including pending/rejected (unlike the public marketplace)
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const firms = await prisma.firm.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ firms: firms.map(presentFirm) });
  })
);

async function loadFirmOr404(id) {
  const firm = await prisma.firm.findUnique({ where: { id } });
  if (!firm) throw new AppError(404, 'Firm not found.');
  return firm;
}

// PATCH /api/admin/firms/:id/verification-status — body: { status }
router.patch(
  '/:id/verification-status',
  asyncHandler(async (req, res) => {
    if (!req.body.status) throw new AppError(400, 'status is required.');
    const statusDb = toDbOrThrow(verificationStatusMap, req.body.status, 'verification status');
    await loadFirmOr404(req.params.id);

    const updated = await prisma.firm.update({
      where: { id: req.params.id },
      data: { verificationStatus: statusDb },
    });
    res.json({ firm: presentFirm(updated) });
  })
);

// PATCH /api/admin/firms/:id/verification-levels — body: { level: 'identity'|'credentials'|'firm', value: boolean }
router.patch(
  '/:id/verification-levels',
  asyncHandler(async (req, res) => {
    const { level, value } = req.body;
    const fieldByLevel = { identity: 'verifyIdentity', credentials: 'verifyCredentials', firm: 'verifyFirm' };
    if (!fieldByLevel[level]) {
      throw new AppError(400, `Invalid level: "${level}". Allowed: identity, credentials, firm`);
    }
    await loadFirmOr404(req.params.id);

    const updated = await prisma.firm.update({
      where: { id: req.params.id },
      data: { [fieldByLevel[level]]: Boolean(value) },
    });
    res.json({ firm: presentFirm(updated) });
  })
);

// PATCH /api/admin/firms/:id/verified-specialisations — body: { specialisation: string }
// Toggles one specialisation in/out of the firm's verifiedSpecialisations list.
// Must already be one of the firm's own claimed specialisations.
router.patch(
  '/:id/verified-specialisations',
  asyncHandler(async (req, res) => {
    const { specialisation } = req.body;
    if (!specialisation) throw new AppError(400, 'specialisation is required.');

    const firm = await loadFirmOr404(req.params.id);
    if (!firm.specialisations.includes(specialisation)) {
      throw new AppError(400, 'This firm has not claimed that specialisation.');
    }

    const current = firm.verifiedSpecialisations;
    const next = current.includes(specialisation)
      ? current.filter((s) => s !== specialisation)
      : [...current, specialisation];

    const updated = await prisma.firm.update({
      where: { id: firm.id },
      data: { verifiedSpecialisations: next },
    });
    res.json({ firm: presentFirm(updated) });
  })
);

module.exports = router;
