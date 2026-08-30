const RESEND_API_KEY = process.env.RESEND_API_KEY;
// Resend requires the "from" address to be on a domain you've verified with
// them. Their shared onboarding@resend.dev sender works with zero setup for
// testing, but delivery is more reliable (and less likely to land in spam)
// once you've verified your own domain — see README / setup notes.
const EMAIL_FROM = process.env.EMAIL_FROM || 'FinProMatch <onboarding@resend.dev>';

/**
 * Sends a plain-ish HTML email via Resend. Best-effort: never throws — a
 * notification email failing to send should never break the request that
 * triggered it (e.g. a guest brief still gets saved to the database even if
 * the email bounces). Returns true/false so callers can log if they want.
 */
async function sendEmail({ to, subject, html }) {
  if (!RESEND_API_KEY) {
    console.log(`[email disabled — no RESEND_API_KEY set] Would have sent "${subject}" to ${to}`);
    return false;
  }
  try {
    const resp = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ from: EMAIL_FROM, to, subject, html }),
    });
    if (!resp.ok) {
      const body = await resp.text().catch(() => '');
      console.error(`Resend email failed (${resp.status}): ${body}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error('Resend email failed:', err.message);
    return false;
  }
}

module.exports = { sendEmail };