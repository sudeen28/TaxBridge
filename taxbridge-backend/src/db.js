const { PrismaClient } = require('@prisma/client');

// Reuse a single PrismaClient across the process (and across hot-reloads in
// dev) instead of creating a new connection pool per request.
const globalForPrisma = globalThis;

const prisma =
  globalForPrisma.__taxbridgePrisma ||
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.__taxbridgePrisma = prisma;
}

module.exports = prisma;
