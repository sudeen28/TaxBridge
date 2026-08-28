const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { presentLead } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loadLeadOr404 } = require('./leads');

const router = express.Router();

// GET /api/leads/matched-to-me — requests where this professional is either
// a candidate match or the chosen professional.
router.get(
  '/matched-to-me',
  requireAuth,
  requireRole('professional'),
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({
      where: {
        OR: [{ matches: { has: req.auth.id } }, { chosenPro: req.auth.id }],
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ leads: leads.map(presentLead) });
  })
);

// POST /api/leads/:id/deliver — professional marks the work as delivered
router.post(
  '/:id/deliver',
  requireAuth,
  requireRole('professional'),
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (lead.chosenPro !== req.auth.id) {
      throw new AppError(403, 'This request was not engaged with you.');
    }
    if (lead.status !== 'PAID') {
      throw new AppError(400, 'This request is not awaiting delivery.');
    }
    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'DELIVERED' },
    });
    res.json({ lead: presentLead(updated) });
  })
);

module.exports = router;
