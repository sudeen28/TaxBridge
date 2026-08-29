const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { AppError } = require('../utils/AppError');
const { presentNotification } = require('../utils/serialize');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.use(requireAuth);

/**
 * Builds the recipient filter for whichever account is currently
 * authenticated. Individual users cover both clients and (legacy track)
 * professionals — both are User rows, so both read recipientUserId.
 */
function recipientWhere(auth) {
  if (auth.role === 'client' || auth.role === 'professional') return { recipientUserId: auth.id };
  if (auth.role === 'firm') return { recipientFirmId: auth.id };
  if (auth.role === 'admin') return { recipientAdminId: auth.id };
  throw new AppError(403, 'Unknown account type.');
}

// GET /api/notifications — current account's notifications, newest first, plus an unread count for the bell badge
router.get(
  '/',
  asyncHandler(async (req, res) => {
    const where = recipientWhere(req.auth);
    const [notifications, unreadCount] = await Promise.all([
      prisma.notification.findMany({ where, orderBy: { createdAt: 'desc' }, take: 100 }),
      prisma.notification.count({ where: { ...where, read: false } }),
    ]);
    res.json({ notifications: notifications.map(presentNotification), unreadCount });
  })
);

// PATCH /api/notifications/:id/read — mark a single notification read (owner only)
router.patch(
  '/:id/read',
  asyncHandler(async (req, res) => {
    const where = recipientWhere(req.auth);
    const existing = await prisma.notification.findFirst({ where: { id: req.params.id, ...where } });
    if (!existing) throw new AppError(404, 'Notification not found.');
    const updated = await prisma.notification.update({ where: { id: existing.id }, data: { read: true } });
    res.json({ notification: presentNotification(updated) });
  })
);

// POST /api/notifications/read-all — mark every unread notification for this account as read
router.post(
  '/read-all',
  asyncHandler(async (req, res) => {
    const where = recipientWhere(req.auth);
    await prisma.notification.updateMany({ where: { ...where, read: false }, data: { read: true } });
    res.json({ success: true });
  })
);

module.exports = router;