const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields } = require('../utils/validate');
const { presentMessage } = require('../utils/serialize');
const { requireAuth } = require('../middleware/auth');
const { messageSenderRole: senderRoleMap } = require('../utils/enumMaps');
const { loadEngagementOr404, canViewEngagement } = require('./engagements');

const router = express.Router();

/**
 * Who may post (not just read) in this thread — same rule as viewing,
 * restated explicitly here because "can view" and "can post" happen to be
 * identical for every role in this app today, but that's a coincidence
 * worth keeping separate in code in case it ever isn't.
 */
function canPostToEngagement(eng, auth) {
  return canViewEngagement(eng, auth);
}

function senderNameFor(eng, auth, account) {
  if (auth.role === 'client') return eng.clientName;
  if (auth.role === 'firm') return account.firmName;
  return account.name || 'TaxBridge team';
}

// GET /api/engagements/:id/messages
router.get(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    const eng = await loadEngagementOr404(req.params.id);
    if (!canViewEngagement(eng, req.auth)) {
      throw new AppError(403, 'You do not have access to this engagement.');
    }
    const messages = await prisma.message.findMany({
      where: { engagementId: eng.id },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ messages: messages.map(presentMessage) });
  })
);

// POST /api/engagements/:id/messages — body: { body: "..." }
router.post(
  '/:id/messages',
  requireAuth,
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['body']);
    const eng = await loadEngagementOr404(req.params.id);
    if (!canPostToEngagement(eng, req.auth)) {
      throw new AppError(403, 'You do not have access to this engagement.');
    }

    // Look up the sender's account to snapshot a display name, and to link
    // the message back to it for senderUserId/senderFirmId where applicable.
    let account = null;
    let senderUserId = null;
    let senderFirmId = null;
    if (req.auth.role === 'client' || req.auth.role === 'admin') {
      account = req.auth.role === 'client' ? await prisma.user.findUnique({ where: { id: req.auth.id } }) : await prisma.admin.findUnique({ where: { id: req.auth.id } });
      if (req.auth.role === 'client') senderUserId = req.auth.id;
    } else if (req.auth.role === 'firm') {
      account = await prisma.firm.findUnique({ where: { id: req.auth.id } });
      senderFirmId = req.auth.id;
    }
    if (!account) throw new AppError(404, 'Account not found.');

    const message = await prisma.message.create({
      data: {
        engagementId: eng.id,
        senderRole: senderRoleMap.toDb[req.auth.role],
        senderName: senderNameFor(eng, req.auth, account),
        body: String(req.body.body).trim(),
        senderUserId,
        senderFirmId,
      },
    });

    res.status(201).json({ message: presentMessage(message) });
  })
);

module.exports = router;
