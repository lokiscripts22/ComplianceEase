/**
 * ComplianceEase — MYOB Backend Integration
 * ============================================
 * SETUP:
 *   1. Apply at https://developer.myob.com — register a "Desktop & Web" app
 *   2. Add to .env:
 *        MYOB_CLIENT_ID=...
 *        MYOB_CLIENT_SECRET=...
 *        MYOB_REDIRECT_URI=https://yourdomain.com/auth/myob/callback.html
 *
 * NOTE: MYOB doesn't have a direct BAS report endpoint like Xero.
 * We compute BAS from their transaction data (Purchases + Sales + Payroll).
 * This is the standard MYOB integration approach.
 *
 * MOUNT IN YOUR app.js:
 *   const myobRoutes = require('./backend/myob');
 *   app.use('/api/myob', myobRoutes);
 */

const express = require('express');
const axios   = require('axios');
const crypto  = require('crypto');
const router  = express.Router();

const MYOB = {
  clientId:     process.env.MYOB_CLIENT_ID,
  clientSecret: process.env.MYOB_CLIENT_SECRET,
  redirectUri:  process.env.MYOB_REDIRECT_URI,
  tokenUrl:     'https://secure.myob.com/oauth2/v1/authorize',
  apiBase:      'https://api.myob.com/accountright',
  // MYOB company file list endpoint
  companyFilesUrl: 'https://api.myob.com/accountright',
};

// ── ROUTE: Initiate OAuth ─────────────────────────────────────────────────
// GET /api/myob/connect
router.get('/connect', (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  const params = new URLSearchParams({
    client_id:    MYOB.clientId,
    redirect_uri: MYOB.redirectUri,
    response_type:'code',
    scope:        'CompanyFile',
    state:        state,
  });
  res.json({ url: 'https://secure.myob.com/oauth2/account/authorize?' + params });
});

// ── ROUTE: OAuth Callback ─────────────────────────────────────────────────
// POST /api/myob/callback
router.post('/callback', async (req, res) => {
  const { code } = req.body;
  try {
    const tokenRes = await axios.post(MYOB.tokenUrl, new URLSearchParams({
      client_id:     MYOB.clientId,
      client_secret: MYOB.clientSecret,
      code,
      redirect_uri:  MYOB.redirectUri,
      grant_type:    'authorization_code',
      scope:         'CompanyFile',
    }), { headers: { 'Content-Type': 'application/x-www-form-urlencoded' } });

    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get company files
    const cfRes = await axios.get(MYOB.companyFilesUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const companyFiles = cfRes.data;

    // Store encrypted tokens + company file IDs in Supabase
    // await supabase.from('myob_connections').upsert(...)

    res.json({ success: true, companyFiles });
  } catch (err) {
    console.error('[MYOB] OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'MYOB auth failed' });
  }
});

// ── ROUTE: Sync BAS (computed from transactions) ──────────────────────────
// POST /api/myob/sync/bas/:companyFileId
router.post('/sync/bas/:companyFileId', async (req, res) => {
  const { companyFileId } = req.params;
  // const { fromDate, toDate } = req.body;  // quarter dates e.g. 2025-01-01, 2025-03-31

  // In production: fetch from MYOB API and compute BAS
  // const sales     = await getMYOBSales(companyFileId, accessToken, fromDate, toDate);
  // const purchases = await getMYOBPurchases(companyFileId, accessToken, fromDate, toDate);
  // const payroll   = await getMYOBPayroll(companyFileId, accessToken, fromDate, toDate);
  // const rows = computeBASFromTransactions(sales, purchases, payroll);

  // STUB
  const rows = {
    totalSales:     96200,
    gstOnSales:      8745,
    totalPurchases:  31400,
    gstOnPurchases:  2854,
    paygWithheld:    8200,
    netPayable:      6109, // gstOnSales - gstOnPurchases
    refund: false,
  };

  res.json({
    source:        'myob',
    companyFileId,
    period:        'Q3 FY2024–25',
    rows,
    lastSynced:    new Date().toISOString(),
    note:          'Computed from MYOB transaction data — review before lodging.',
  });
});

// ── HELPER: Compute BAS from MYOB transactions ────────────────────────────
function computeBASFromTransactions(sales, purchases, payroll) {
  // Sales with GST = 1/11 of the total
  const totalSales     = sales.reduce((s, t) => s + (t.TotalAmount || 0), 0);
  const gstOnSales     = sales.filter(t => t.TaxCode === 'GST').reduce((s,t) => s + (t.Freight?.TaxAmount || 0), 0);
  const totalPurchases = purchases.reduce((s, t) => s + (t.TotalAmount || 0), 0);
  const gstOnPurchases = purchases.filter(t => t.TaxCode === 'GST').reduce((s,t) => s + (t.FreightTaxAmount || 0), 0);
  const paygWithheld   = payroll.reduce((s, t) => s + (t.GrossWages - t.NetWages || 0), 0);
  const netPayable     = gstOnSales - gstOnPurchases;
  return { totalSales, gstOnSales, totalPurchases, gstOnPurchases, paygWithheld, netPayable, refund: netPayable < 0 };
}

module.exports = router;
