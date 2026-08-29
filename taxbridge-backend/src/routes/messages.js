const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { requireFields } = require('../utils/validate');
const { presentMessage } = require('../utils/serialize');
const { requireAuth } = require('../middleware/auth');
const { messageSenderRole: senderRoleMap, CONTACT_VISIBLE_STATUSES, engagementStatus: statusMap } = require('../utils/enumMaps');
const { loadEngagementOr404, canViewEngagement } = require('./engagements');
const { notifyClient, notifyFirm } = require('../utils/notify');

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

/**
 * Notifies everyone with access to this thread except whoever just sent the
 * message: the client (unless they're the sender), and every firm in
 * selectedFirmIds whose contact is currently visible (unless one of them is
 * the sender). Best-effort — a notification failure should never block the
 * message itself from being posted.
 */
async function notifyThreadRecipients(eng, senderAuth, preview) {
  const jobs = [];
  const contactVisible = CONTACT_VISIBLE_STATUSES.includes(statusMap.fromDb[eng.status]);

  if (senderAuth.role !== 'client') {
    jobs.push(
      notifyClient(
        eng.clientId,
        'MESSAGE_RECEIVED',
        'New message',
        preview,
        eng.id
      )
    );
  }
  if (contactVisible) {
    eng.selectedFirmIds
      .filter((firmId) => !(senderAuth.role === 'firm' && senderAuth.id === firmId))
      .forEach((firmId) => {
        jobs.push(notifyFirm(firmId, 'MESSAGE_RECEIVED', 'New message', preview, eng.id));
      });
  }

  try {
    await Promise.all(jobs);
  } catch (err) {
    // A notification failing to write is not worth failing the request over.
  }
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

    const bodyText = String(req.body.body).trim();

    const message = await prisma.message.create({
      data: {
        engagementId: eng.id,
        senderRole: senderRoleMap.toDb[req.auth.role],
        senderName: senderNameFor(eng, req.auth, account),
        body: bodyText,
        senderUserId,
        senderFirmId,
      },
    });

    const preview = bodyText.length > 140 ? bodyText.slice(0, 137) + '…' : bodyText;
    await notifyThreadRecipients(eng, req.auth, `${senderNameFor(eng, req.auth, account)}: ${preview}`);

    res.status(201).json({ message: presentMessage(message) });
  })
);

module.exports = router;