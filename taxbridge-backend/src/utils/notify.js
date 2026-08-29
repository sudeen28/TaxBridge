const prisma = require('../db');

/**
 * Thin wrappers around prisma.notification.create, one per recipient kind —
 * mirrors the recipientUser/recipientFirm/recipientAdmin split on the
 * Notification model itself. `type` is the raw DB enum value (e.g.
 * 'ENGAGEMENT_MATCHED'), since these are only ever called from other
 * server-side routes, never from user input.
 */
function notifyClient(userId, type, title, body, link = null) {
  return prisma.notification.create({
    data: { type, title, body, link, recipientUserId: userId },
  });
}

function notifyFirm(firmId, type, title, body, link = null) {
  return prisma.notification.create({
    data: { type, title, body, link, recipientFirmId: firmId },
  });
}

function notifyAdmin(adminId, type, title, body, link = null) {
  return prisma.notification.create({
    data: { type, title, body, link, recipientAdminId: adminId },
  });
}

module.exports = { notifyClient, notifyFirm, notifyAdmin };