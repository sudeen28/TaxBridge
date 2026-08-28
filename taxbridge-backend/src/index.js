require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');

const { attachAuth } = require('./middleware/auth');
const { errorHandler } = require('./middleware/errorHandler');

const clientAuthRoutes = require('./routes/auth.client');
const proAuthRoutes = require('./routes/auth.pro');
const firmAuthRoutes = require('./routes/auth.firm');
const adminAuthRoutes = require('./routes/auth.admin');

const app = express();

// --- core middleware ---
const allowedOrigins = (process.env.CORS_ORIGINS || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length ? allowedOrigins : true, // reflect request origin if none configured (dev-friendly default)
    credentials: true,
  })
);
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());
app.use(attachAuth); // decodes a bearer token into req.auth on every request, if present

// --- health check (useful for Render's health checks / uptime monitors) ---
app.get('/health', (req, res) => {
  res.json({ ok: true, service: 'taxbridge-backend', time: new Date().toISOString() });
});

// --- routes ---
// Auth is split by account type because they're genuinely separate tables
// (User for client/professional, Firm, Admin) with different signup fields.
app.use('/api/auth/client', clientAuthRoutes);
app.use('/api/auth/professional', proAuthRoutes);
app.use('/api/auth/firm', firmAuthRoutes);
app.use('/api/auth/admin', adminAuthRoutes);

// Resource routes (engagements, firms marketplace, messages, leads, admin
// operations) land here in the next backend phase — this scaffold covers
// project setup, the data model, and authentication first.

// --- 404 for anything unmatched under /api ---
app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Not found.' });
});

// --- central error handler (must be registered last) ---
app.use(errorHandler);

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`TaxBridge backend listening on port ${PORT}`);
});

module.exports = app;
