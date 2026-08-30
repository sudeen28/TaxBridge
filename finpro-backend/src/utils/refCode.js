/**
 * Generates a ref code like "ENG-48213" and retries against the DB's
 * unique constraint on the rare chance of a collision, rather than trusting
 * randomness alone — a plain 5-digit space is small enough to collide at
 * real volume.
 *
 * @param {import('@prisma/client').PrismaClient[keyof import('@prisma/client').PrismaClient]} model - e.g. prisma.engagement
 * @param {string} prefix - e.g. 'ENG', 'TXB'
 */
async function generateUniqueRefCode(model, prefix) {
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = `${prefix}-${Math.floor(10000 + Math.random() * 90000)}`;
    const existing = await model.findUnique({ where: { refCode: code } });
    if (!existing) return code;
  }
  // Exhausted retries (astronomically unlikely) — fall back to a longer code.
  return `${prefix}-${Date.now()}`;
}

module.exports = { generateUniqueRefCode };
