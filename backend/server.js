/**
 * ComplianceEase — Backend Server
 * ================================
 * Express.js API server
 *
 * SETUP:
 *   npm install express cors helmet dotenv axios @supabase/supabase-js crypto twilio resend
 *
 * DEVELOPMENT:
 *   node backend/server.js
 *   or: npx nodemon backend/server.js
 *
 * PRODUCTION (Vercel):
 *   Deploy this as a Vercel serverless function
 *   See: https://vercel.com/docs/functions
 *
 * PRODUCTION (Railway / Render):
 *   Connect your GitHub repo, set env vars, deploy
 */

require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const helmet  = require('helmet');

const app = express();

// ── MIDDLEWARE ────────────────────────────────────────────────────────────
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
}));
app.use(express.json());

// ── ROUTES ────────────────────────────────────────────────────────────────
app.use('/api/xero',          require('./xero'));           // Xero OAuth + BAS sync
app.use('/api/myob',          require('./myob'));           // MYOB OAuth + BAS sync
app.use('/api/notifications', require('./notifications')); // Email (Resend) + SMS (Twilio)
app.use('/api/ai-emails',     require('./ai-emails'));      // AI email composer (Anthropic)
app.use('/api/portal',        require('./portal'));         // Client portal + photo uploads

// app.use('/api/stripe',     require('./stripe'));          // billing — add Stripe keys first
// app.use('/api/clients',    require('./clients'));         // client CRUD
// app.use('/api/obligations',require('./obligations'));     // deadline management

// ── HEALTH CHECK ──────────────────────────────────────────────────────────
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', version: '3.0.0', timestamp: new Date().toISOString() });
});

// ── START ─────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => console.log(`ComplianceEase API running on port ${PORT}`));

module.exports = app;
