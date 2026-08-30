const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

const VALID_STATUSES = ['NEW', 'CONTACTED', 'CONVERTED', 'CLOSED'];

// GET /api/admin/guest-briefs — newest first
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const briefs = await prisma.guestBrief.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ briefs });
  })
);

// PATCH /api/admin/guest-briefs/:id/status — body: { status }
router.patch(
  '/:id/status',
  asyncHandler(async (req, res) => {
    const status = String(req.body.status || '').toUpperCase();
    if (!VALID_STATUSES.includes(status)) {
      throw new AppError(400, `Invalid status. Allowed: ${VALID_STATUSES.join(', ')}`);
    }
    const existing = await prisma.guestBrief.findUnique({ where: { id: req.params.id } });
    if (!existing) throw new AppError(404, 'Brief not found.');

    const updated = await prisma.guestBrief.update({ where: { id: existing.id }, data: { status } });
    res.json({ brief: updated });
  })
);

module.exports = router;