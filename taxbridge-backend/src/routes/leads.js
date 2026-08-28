const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields } = require('../utils/validate');
const { generateUniqueRefCode } = require('../utils/refCode');
const { presentLead } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');

const router = express.Router();

const DEFAULT_FEE_AMOUNT = 200000; // ₦ — matches the frontend's default when a client chooses a pro before admin has set a fee

// Statuses where deleting is safe: nothing has been matched/paid/delivered
// yet (PENDING), or the whole thing has already concluded (RELEASED).
// Anything in between (MATCHED/ENGAGED/PAID/DELIVERED) has a professional
// actively involved, so deletion is blocked there — same reasoning as
// engagements: don't let a client pull a record out from under someone
// else mid-flow.
const DELETABLE_LEAD_STATUSES = ['PENDING', 'RELEASED'];

async function loadLeadOr404(id) {
  const lead = await prisma.lead.findUnique({ where: { id } });
  if (!lead) throw new AppError(404, 'Request not found.');
  return lead;
}

// POST /api/leads — client submits an individual-professional request
router.post(
  '/',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['need', 'details']);

    const client = await prisma.user.findUnique({ where: { id: req.auth.id } });
    if (!client) throw new AppError(404, 'Account not found.');

    const refCode = await generateUniqueRefCode(prisma.lead, 'TXB');

    const lead = await prisma.lead.create({
      data: {
        refCode,
        clientId: client.id,
        name: client.name,
        contact: client.phone || client.email,
        company: req.body.company ? String(req.body.company).trim() : null,
        need: String(req.body.need).trim(),
        budget: req.body.budget ? String(req.body.budget).trim() : null,
        details: String(req.body.details).trim(),
        status: 'PENDING',
        interestedFirmId: req.body.interestedFirmId ? String(req.body.interestedFirmId) : null,
      },
    });

    res.status(201).json({ lead: presentLead(lead) });
  })
);

// GET /api/leads/mine — client's own requests
router.get(
  '/mine',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    const leads = await prisma.lead.findMany({
      where: { clientId: req.auth.id },
      orderBy: { createdAt: 'desc' },
    });
    res.json({ leads: leads.map(presentLead) });
  })
);

/**
 * GET /api/leads/interested-in-me — for a firm's dashboard: individual-track
 * requests that named this firm as a preference, before any admin match.
 * Deliberately minimal fields — this is an informational nudge, not an
 * introduction, so no client contact details are exposed here.
 */
router.get(
  '/interested-in-me',
  requireAuth,
  requireRole('firm'),
  asyncHandler(async (req, res) => {
    const { leadStatus } = require('../utils/enumMaps');
    const leads = await prisma.lead.findMany({
      where: { interestedFirmId: req.auth.id },
      orderBy: { createdAt: 'desc' },
      select: { id: true, need: true, status: true },
    });
    res.json({ leads: leads.map((l) => ({ ...l, status: leadStatus.fromDb[l.status] })) });
  })
);

/**
 * GET /api/leads/:id/matches — the public-safe fields of this lead's matched
 * professionals, for the owning client to choose between. Registered before
 * the bare /:id route since it's a more specific path.
 * Only visible once status is 'matched' or later — matches the frontend,
 * which only shows matches at that point.
 */
router.get(
  '/:id/matches',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (lead.clientId !== req.auth.id) throw new AppError(403, 'You do not have access to this request.');

    const pros = await prisma.user.findMany({
      where: { id: { in: lead.matches }, role: 'PROFESSIONAL' },
    });

    const withRatings = await Promise.all(
      pros.map(async (pro) => {
        const rating = await computeProRating(pro.id);
        return {
          id: pro.id,
          name: pro.name,
          professionalBody: pro.professionalBody,
          expertise: pro.expertise,
          yearsExperience: pro.yearsExperience,
          bio: pro.bio,
          rating,
        };
      })
    );

    res.json({ professionals: withRatings });
  })
);

// GET /api/leads/:id
router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    const isOwner = req.auth.role === 'client' && lead.clientId === req.auth.id;
    const isChosenPro = req.auth.role === 'professional' && lead.chosenPro === req.auth.id;
    const isAdmin = req.auth.role === 'admin';
    if (!isOwner && !isChosenPro && !isAdmin) {
      throw new AppError(403, 'You do not have access to this request.');
    }

    // Reveal the chosen professional's contact details only once payment is
    // confirmed — matches the frontend's paid/delivered/released gating.
    let chosenProDetails = null;
    if (lead.chosenPro && ['PAID', 'DELIVERED', 'RELEASED'].includes(lead.status)) {
      const pro = await prisma.user.findUnique({ where: { id: lead.chosenPro } });
      if (pro) chosenProDetails = { id: pro.id, name: pro.name, contact: pro.phone || pro.email };
    }

    res.json({ lead: presentLead(lead), chosenProDetails });
  })
);

// POST /api/leads/:id/choose — client picks one of the matched professionals
router.post(
  '/:id/choose',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['professionalId']);
    const lead = await loadLeadOr404(req.params.id);
    if (lead.clientId !== req.auth.id) throw new AppError(403, 'You do not have access to this request.');
    if (lead.status !== 'MATCHED') throw new AppError(400, 'This request is not ready to choose a professional yet.');
    if (!lead.matches.includes(req.body.professionalId)) {
      throw new AppError(400, 'That professional was not matched to this request.');
    }

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: {
        chosenPro: req.body.professionalId,
        status: 'ENGAGED',
        feeAmount: lead.feeAmount ?? DEFAULT_FEE_AMOUNT,
      },
    });
    res.json({ lead: presentLead(updated) });
  })
);

// POST /api/leads/:id/pay — simulated payment step (see README: no real payment provider is wired up)
router.post(
  '/:id/pay',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (lead.clientId !== req.auth.id) throw new AppError(403, 'You do not have access to this request.');
    if (lead.status !== 'ENGAGED') throw new AppError(400, 'This request is not awaiting payment.');

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { status: 'PAID', paidAt: new Date() },
    });
    res.json({ lead: presentLead(updated) });
  })
);

// POST /api/leads/:id/rating — body: { rating: 1-5, review? }
router.post(
  '/:id/rating',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['rating']);
    const rating = Number(req.body.rating);
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
      throw new AppError(400, 'rating must be a whole number from 1 to 5.');
    }

    const lead = await loadLeadOr404(req.params.id);
    if (lead.clientId !== req.auth.id) throw new AppError(403, 'You do not have access to this request.');
    if (lead.status !== 'RELEASED') throw new AppError(400, 'This request is not eligible for review yet.');

    const updated = await prisma.lead.update({
      where: { id: lead.id },
      data: { rating, review: req.body.review ? String(req.body.review).trim() : null },
    });
    res.json({ lead: presentLead(updated) });
  })
);

/**
 * DELETE /api/leads/:id — client permanently removes a request from their
 * own history. Only allowed while PENDING (nothing has happened yet, so
 * there's nothing else to disturb) or RELEASED (the engagement is fully
 * concluded). Blocked in between — MATCHED/ENGAGED/PAID/DELIVERED all mean
 * a professional is actively involved or payment is in flight, so deleting
 * the record then would pull it out from under them.
 */
router.delete(
  '/:id',
  requireAuth,
  requireRole('client'),
  asyncHandler(async (req, res) => {
    const lead = await loadLeadOr404(req.params.id);
    if (lead.clientId !== req.auth.id) throw new AppError(403, 'You do not have access to this request.');
    if (!DELETABLE_LEAD_STATUSES.includes(lead.status)) {
      throw new AppError(400, 'This request is in progress and can no longer be deleted.');
    }
    await prisma.lead.delete({ where: { id: lead.id } });
    res.json({ success: true });
  })
);

/** Shared by client-facing match listing and (later) a professional's public rating. */
async function computeProRating(professionalId) {
  const rated = await prisma.lead.findMany({
    where: { chosenPro: professionalId, rating: { not: null } },
    select: { rating: true },
  });
  if (!rated.length) return null;
  const avg = rated.reduce((sum, l) => sum + l.rating, 0) / rated.length;
  return { avg, count: rated.length };
}

module.exports = { router, loadLeadOr404, computeProRating };