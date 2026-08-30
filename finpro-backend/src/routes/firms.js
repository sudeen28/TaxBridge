const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { presentFirm } = require('../utils/serialize');
const { requireAuth, requireRole } = require('../middleware/auth');
const { capacity: capacityMap, availability: availabilityMap, toDbOrThrow } = require('../utils/enumMaps');

const router = express.Router();

function toStringArray(value) {
  if (Array.isArray(value)) return value.map((v) => String(v).trim()).filter(Boolean);
  if (typeof value === 'string' && value.trim()) {
    return value.split(',').map((v) => v.trim()).filter(Boolean);
  }
  return [];
}

/**
 * GET /api/firms — public marketplace listing with filters, mirroring the
 * frontend's applyFirmFilters (Phase 10): q, specialisation, industry,
 * capacity, location, availability, minExperience, verifiedOnly, remoteOnly.
 * Never returns rejected firms — matches the frontend's existing rule.
 */
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const { q, specialisation, industry, capacity, location, availability, minExperience, verifiedOnly, remoteOnly } =
      req.query;

    const where = { verificationStatus: { not: 'REJECTED' } };

    if (specialisation) where.specialisations = { has: specialisation };
    if (industry) where.industries = { has: industry };
    if (capacity) where.capacity = toDbOrThrow(capacityMap, capacity, 'capacity');
    if (location) where.headquarters = location;
    if (availability) where.availability = toDbOrThrow(availabilityMap, availability, 'availability');
    if (verifiedOnly === 'true') where.verificationStatus = 'VERIFIED';
    if (remoteOnly === 'true') where.remoteAvailable = true;

    if (q) {
      const term = String(q);
      where.OR = [
        { firmName: { contains: term, mode: 'insensitive' } },
        { headquarters: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
        { citiesServed: { has: term } },
      ];
    }

    let firms = await prisma.firm.findMany({ where, orderBy: { createdAt: 'desc' } });

    if (minExperience) {
      const min = parseInt(minExperience, 10) || 0;
      const currentYear = new Date().getFullYear();
      firms = firms.filter((f) => {
        const years = f.yearEstablished ? currentYear - Number(f.yearEstablished) : 0;
        return years >= min;
      });
    }

    // Verified firms first, matching the frontend's marketplace sort.
    firms.sort((a, b) => (b.verificationStatus === 'VERIFIED') - (a.verificationStatus === 'VERIFIED'));

    // Track-record signal (Phase 11): count of completed engagements per firm,
    // computed from real data — never a synthetic score or star rating.
    const engagements = await prisma.engagement.findMany({
      where: { status: 'COMPLETED' },
      select: { selectedFirmIds: true },
    });
    const completedCountByFirm = {};
    engagements.forEach((eng) => {
      eng.selectedFirmIds.forEach((firmId) => {
        completedCountByFirm[firmId] = (completedCountByFirm[firmId] || 0) + 1;
      });
    });

    const shaped = firms.map((f) => ({
      ...presentFirm(f),
      completedCount: completedCountByFirm[f.id] || 0,
    }));

    res.json({ firms: shaped, count: shaped.length });
  })
);

/**
 * PATCH /api/firms/me — firm updates its own profile.
 * Registered BEFORE /:id so "me" is never swallowed as a firm id.
 * Editing credentials moves a verified firm back to pending review,
 * matching the frontend's existing behaviour.
 */
router.patch(
  '/me',
  requireAuth,
  requireRole('firm'),
  asyncHandler(async (req, res) => {
    const firm = await prisma.firm.findUnique({ where: { id: req.auth.id } });
    if (!firm) throw new AppError(404, 'Firm account not found.');

    const b = req.body;
    const data = {};

    if (b.firmName !== undefined) data.firmName = String(b.firmName).trim();
    if (b.phone !== undefined) data.phone = b.phone ? String(b.phone).trim() : null;
    if (b.logoInitials !== undefined) data.logoInitials = b.logoInitials ? String(b.logoInitials).trim() : null;
    if (b.website !== undefined) data.website = b.website ? String(b.website).trim() : null;
    if (b.yearEstablished !== undefined) data.yearEstablished = b.yearEstablished ? String(b.yearEstablished).trim() : null;

    if (b.headquarters !== undefined) data.headquarters = b.headquarters ? String(b.headquarters).trim() : null;
    if (b.citiesServed !== undefined) data.citiesServed = toStringArray(b.citiesServed);
    if (b.statesServed !== undefined) data.statesServed = toStringArray(b.statesServed);
    if (b.countriesServed !== undefined) data.countriesServed = toStringArray(b.countriesServed);
    if (b.remoteAvailable !== undefined) data.remoteAvailable = Boolean(b.remoteAvailable);

    if (b.description !== undefined) data.description = b.description ? String(b.description).trim() : null;

    if (b.specialisations !== undefined) data.specialisations = toStringArray(b.specialisations);
    if (b.industries !== undefined) data.industries = toStringArray(b.industries);

    if (b.capacity !== undefined) data.capacity = toDbOrThrow(capacityMap, b.capacity, 'capacity');
    if (b.availability !== undefined) data.availability = toDbOrThrow(availabilityMap, b.availability, 'availability');

    // Credentials — a nested object on input, matching what the frontend sends.
    let credentialsTouched = false;
    if (b.credentials !== undefined) {
      credentialsTouched = true;
      if (b.credentials.ican !== undefined) data.credentialIcan = b.credentials.ican ? String(b.credentials.ican).trim() : null;
      if (b.credentials.anan !== undefined) data.credentialAnan = b.credentials.anan ? String(b.credentials.anan).trim() : null;
      if (b.credentials.citn !== undefined) data.credentialCitn = b.credentials.citn ? String(b.credentials.citn).trim() : null;
      if (b.credentials.other !== undefined) data.credentialOther = b.credentials.other ? String(b.credentials.other).trim() : null;
      if (b.credentials.verificationDocs !== undefined) {
        data.verificationDocs = b.credentials.verificationDocs ? String(b.credentials.verificationDocs).trim() : null;
      }
    }

    // Matches the frontend: editing credentials while verified moves the
    // firm back to pending — a credential change needs re-review.
    if (credentialsTouched && firm.verificationStatus === 'VERIFIED') {
      data.verificationStatus = 'PENDING';
    }

    const updated = await prisma.firm.update({ where: { id: firm.id }, data });
    res.json({ firm: presentFirm(updated) });
  })
);

// GET /api/firms/:id — public single firm profile
router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const firm = await prisma.firm.findUnique({ where: { id: req.params.id } });
    if (!firm || firm.verificationStatus === 'REJECTED') {
      throw new AppError(404, 'Firm not found.');
    }

    const completed = await prisma.engagement.count({
      where: { status: 'COMPLETED', selectedFirmIds: { has: firm.id } },
    });

    res.json({ firm: { ...presentFirm(firm), completedCount: completed } });
  })
);

module.exports = router;
