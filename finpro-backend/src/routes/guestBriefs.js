const express = require('express');
const prisma = require('../db');
const { asyncHandler } = require('../utils/asyncHandler');
const { requireFields } = require('../utils/validate');
const { sendEmail } = require('../utils/sendEmail');

const router = express.Router();

const BRIEF_NOTIFY_EMAIL = process.env.BRIEF_NOTIFY_EMAIL || process.env.ADMIN_EMAIL;

function esc(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// POST /api/guest-briefs — no login required. Name, a way to reach them, and
// what they need help with. Captured immediately in the database regardless
// of whether the notification email actually goes out.
router.post(
  '/',
  asyncHandler(async (req, res) => {
    requireFields(req.body, ['name', 'contact', 'brief']);

    const brief = await prisma.guestBrief.create({
      data: {
        name: String(req.body.name).trim(),
        contact: String(req.body.contact).trim(),
        brief: String(req.body.brief).trim(),
      },
    });

    if (BRIEF_NOTIFY_EMAIL) {
      await sendEmail({
        to: BRIEF_NOTIFY_EMAIL,
        subject: `New quick brief from ${brief.name}`,
        html: `
          <p><strong>${esc(brief.name)}</strong> just sent a quick brief through the site (no account created).</p>
          <p><strong>Contact:</strong> ${esc(brief.contact)}</p>
          <p><strong>What they need:</strong></p>
          <p>${esc(brief.brief).replace(/\n/g, '<br>')}</p>
          <p style="color:#888;font-size:12px;">Reply directly to ${esc(brief.contact)}, or view it in the admin panel under Quick Briefs.</p>
        `,
      });
    }

    res.status(201).json({ success: true });
  })
);

module.exports = router;