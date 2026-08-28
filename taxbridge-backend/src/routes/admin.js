const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { publicAccount } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { STATUS_STAGE } = require('../utils/enumMaps');

const router = express.Router();

router.use(requireAuth, requireRole('admin'));

// GET /api/admin/professionals — individual professionals (legacy track)
router.get(
  '/professionals',
  asyncHandler(async (req, res) => {
    const pros = await prisma.user.findMany({
      where: { role: 'PROFESSIONAL' },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ professionals: pros.map(publicAccount) });
  })
);

// PATCH /api/admin/professionals/:id/verify — body: { verified: boolean }
router.patch(
  '/professionals/:id/verify',
  asyncHandler(async (req, res) => {
    const pro = await prisma.user.findUnique({ where: { id: req.params.id } });
    if (!pro || pro.role !== 'PROFESSIONAL') throw new AppError(404, 'Professional account not found.');

    const updated = await prisma.user.update({
      where: { id: pro.id },
      data: { verified: Boolean(req.body.verified) },
    });
    res.json({ professional: publicAccount(updated) });
  })
);

// GET /api/admin/stats — the numbers behind the admin dashboard's stats strip (Phase 8)
router.get(
  '/stats',
  asyncHandler(async (req, res) => {
    const [engagements, firms, pros, activeLeads] = await Promise.all([
      prisma.engagement.findMany({ select: { status: true } }),
      prisma.firm.findMany({ select: { verificationStatus: true } }),
      prisma.user.findMany({ where: { role: 'PROFESSIONAL' }, select: { verified: true } }),
      prisma.lead.count({ where: { status: { not: 'RELEASED' } } }),
    ]);

    const stageCounts = { reviewing: 0, matched: 0, completed: 0, closed: 0 };
    engagements.forEach((e) => {
      // engagement.status here is the raw DB enum (UPPER_SNAKE); STATUS_STAGE
      // is keyed by lowercase ids, so lowercase it for the lookup.
      const stage = STATUS_STAGE[e.status.toLowerCase()];
      if (stage) stageCounts[stage] += 1;
    });

    res.json({
      awaitingReview: stageCounts.reviewing,
      matchedActive: stageCounts.matched,
      completed: stageCounts.completed,
      firmsNeedingReview: firms.filter((f) => ['PENDING', 'INFO_REQUIRED'].includes(f.verificationStatus)).length,
      verifiedFirms: firms.filter((f) => f.verificationStatus === 'VERIFIED').length,
      prosNeedingReview: pros.filter((p) => !p.verified).length,
      activeIndividualRequests: activeLeads,
    });
  })
);

module.exports = router;
