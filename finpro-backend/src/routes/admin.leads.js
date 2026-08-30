const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { presentLead } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { loadLeadOr404 } = require('./leads');

const router = express.Router();
const MAX_MATCHES = 3;

router.use(requireAuth, requireRole('admin'));

// GET /api/admin/leads — full list, newest first
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({ orderBy: { createdAt: 'desc' } });
    res.json({ leads: leads.map(presentLead) });
  })
);

// PATCH /api/admin/leads/:id/matches — body: { professionalId } — toggles in/out, capped at 3, verified-only
router.patch(
  '/:id/matches',
  asyncHandler(async (req, res) => {
    requireProfessionalId(req.body);
    const lead = await loadLeadOr404(req.params.id);

    const pro = await prisma.user.findUnique({ where: { id: req.body.professionalId } });
    if (!pro || pro.role !== 'PROFESSIONAL') throw new AppError(404, 'Professional not found.');

    const current = lead.matches;
    const isSelected = current.includes(pro.id);

    if (!isSelected) {
      if (!pro.verified) {
        throw new AppError(400, 'Only verified professionals can be matched.');
      }
      if (current.length >= MAX_MATCHES) {
        throw new AppError(400, `You can match at most ${MAX_MATCHES} professionals.`);
      }
    }

    const next = isSelected ? current.filter((id) => id !== pro.id) : [...current, pro.id];

    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { matches: next } });
    res.json({ lead: presentLead(updated) });
  })
);

// POST /api/admin/leads/:id/confirm-match — status -> matched, notifies the client (in spirit; no real notification wired up yet)
router.post(
  '/:id/confirm-match',
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (!lead.matches.length) throw new AppError(400, 'Select at least one professional first.');

    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status: 'MATCHED' } });
    res.json({ lead: presentLead(updated) });
  })
);

// PATCH /api/admin/leads/:id/fee — body: { feeAmount, scopeNote }
router.patch(
  '/:id/fee',
  asyncHandler(async (req, res) => {
    const feeAmount = Number(req.body.feeAmount);
    if (!Number.isFinite(feeAmount) || feeAmount < 0) {
      throw new AppError(400, 'feeAmount must be a non-negative number.');
    }
    const lead = await loadLeadOr404(req.params.id);

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        feeAmount: Math.round(feeAmount),
        scopeNote: req.body.scopeNote !== undefined ? String(req.body.scopeNote).trim() : lead.scopeNote,
      },
    });
    res.json({ lead: presentLead(updated) });
  })
);

// POST /api/admin/leads/:id/release-payment — only once the professional has marked work delivered
router.post(
  '/:id/release-payment',
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (lead.status !== 'DELIVERED') {
      throw new AppError(400, 'Payment can only be released after the work is marked delivered.');
    }
    const updated = await prisma.lead.update({ where: { id: lead.id }, data: { status: 'RELEASED' } });
    res.json({ lead: presentLead(updated) });
  })
);

function requireProfessionalId(body) {
  if (!body.professionalId) throw new AppError(400, 'professionalId is required.');
}

module.exports = router;
