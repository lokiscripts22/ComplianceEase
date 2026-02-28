/**
 * ComplianceEase — Xero Backend Integration
 * ============================================
 * Node.js / Express routes for Xero OAuth2 + BAS sync
 *
 * SETUP:
 *   1. npm install express axios @supabase/supabase-js crypto
 *   2. Apply for Xero app at https://developer.xero.com/myapps
 *   3. Add to your .env:
 *        XERO_CLIENT_ID=...
 *        XERO_CLIENT_SECRET=...
 *        XERO_REDIRECT_URI=https://yourdomain.com/auth/xero/callback.html
 *        SUPABASE_URL=...
 *        SUPABASE_SERVICE_ROLE_KEY=...   ← NOT the anon key — this is backend only
 *
 * MOUNT IN YOUR app.js (server):
 *   const xeroRoutes = require('./backend/xero');
 *   app.use('/api/xero', xeroRoutes);
 */

const express  = require('express');
const axios    = require('axios');
const crypto   = require('crypto');
const router   = express.Router();

// ── Supabase admin client (server-side only) ──────────────────────────────
// const { createClient } = require('@supabase/supabase-js');
// const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const XERO = {
  clientId:     process.env.XERO_CLIENT_ID,
  clientSecret: process.env.XERO_CLIENT_SECRET,
  redirectUri:  process.env.XERO_REDIRECT_URI,
  tokenUrl:     'https://identity.xero.com/connect/token',
  apiBase:      'https://api.xero.com/api.xro/2.0',
  connectionsUrl: 'https://api.xero.com/connections',
};

// ── ENCRYPTION HELPERS ────────────────────────────────────────────────────
// Tokens are encrypted at rest using AES-256-GCM
const ENCRYPTION_KEY = process.env.TOKEN_ENCRYPTION_KEY; // 32-byte hex string

function encryptToken(text) {
  const iv  = crypto.randomBytes(16);
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return iv.toString('hex') + ':' + encrypted.toString('hex') + ':' + tag.toString('hex');
}

function decryptToken(text) {
  const [ivHex, encHex, tagHex] = text.split(':');
  const key = Buffer.from(ENCRYPTION_KEY, 'hex');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, Buffer.from(ivHex, 'hex'));
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  return decipher.update(Buffer.from(encHex, 'hex')) + decipher.final('utf8');
}

// ── AUTH MIDDLEWARE ────────────────────────────────────────────────────────
async function requireAuth(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Unauthorized' });
  // const { data: { user }, error } = await supabase.auth.getUser(token);
  // if (error || !user) return res.status(401).json({ error: 'Invalid token' });
  // req.user = user;
  req.user = { id: 'demo-user' }; // STUB: replace with supabase check
  next();
}

// ── ROUTE: Initiate OAuth ─────────────────────────────────────────────────
// GET /api/xero/connect
// Frontend calls this to get the Xero auth URL, then redirects user
router.get('/connect', requireAuth, (req, res) => {
  const state = crypto.randomBytes(16).toString('hex');
  // Store state in Supabase or session for CSRF verification
  // await supabase.from('oauth_states').insert({ user_id: req.user.id, state, provider: 'xero' });
  
  const params = new URLSearchParams({
    response_type: 'code',
    client_id:     XERO.clientId,
    redirect_uri:  XERO.redirectUri,
    scope:         'openid profile email accounting.reports.read accounting.settings offline_access',
    state:         state,
  });
  res.json({ url: 'https://login.xero.com/identity/connect/authorize?' + params });
});

// ── ROUTE: OAuth Callback ─────────────────────────────────────────────────
// POST /api/xero/callback
// Backend receives auth code, exchanges for tokens, stores encrypted
router.post('/callback', requireAuth, async (req, res) => {
  const { code, state } = req.body;
  
  // Verify state (CSRF protection)
  // const { data: stateRecord } = await supabase
  //   .from('oauth_states').select().eq('state', state).eq('user_id', req.user.id).single();
  // if (!stateRecord) return res.status(400).json({ error: 'Invalid state' });
  
  try {
    // Exchange code for tokens
    const tokenRes = await axios.post(XERO.tokenUrl,
      new URLSearchParams({ grant_type: 'authorization_code', code, redirect_uri: XERO.redirectUri }),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        auth: { username: XERO.clientId, password: XERO.clientSecret },
      }
    );
    const { access_token, refresh_token, expires_in } = tokenRes.data;

    // Get connected tenants (Xero organisations)
    const connectionsRes = await axios.get(XERO.connectionsUrl, {
      headers: { Authorization: `Bearer ${access_token}` }
    });
    const tenants = connectionsRes.data;

    // Store encrypted tokens per tenant in Supabase
    for (const tenant of tenants) {
      // await supabase.from('xero_connections').upsert({
      //   user_id:       req.user.id,
      //   tenant_id:     tenant.tenantId,
      //   tenant_name:   tenant.tenantName,
      //   access_token:  encryptToken(access_token),
      //   refresh_token: encryptToken(refresh_token),
      //   expires_at:    new Date(Date.now() + expires_in * 1000).toISOString(),
      // }, { onConflict: 'user_id,tenant_id' });
      console.log('[Xero] Connected tenant:', tenant.tenantName);
    }

    res.json({ success: true, tenants: tenants.map(t => ({ id: t.tenantId, name: t.tenantName })) });
  } catch (err) {
    console.error('[Xero] OAuth error:', err.response?.data || err.message);
    res.status(500).json({ error: 'Token exchange failed' });
  }
});

// ── ROUTE: Sync BAS Report ────────────────────────────────────────────────
// POST /api/xero/sync/bas/:tenantId
// Fetches BAS/GST report from Xero and returns structured data
router.post('/sync/bas/:tenantId', requireAuth, async (req, res) => {
  const { tenantId } = req.params;

  // Get + decrypt tokens from Supabase
  // const { data: conn } = await supabase.from('xero_connections')
  //   .select().eq('user_id', req.user.id).eq('tenant_id', tenantId).single();
  // if (!conn) return res.status(404).json({ error: 'Xero not connected for this client' });
  
  // const accessToken = decryptToken(conn.access_token);
  const accessToken = 'DEMO_TOKEN'; // STUB

  // Check if token needs refresh
  // if (new Date(conn.expires_at) < new Date()) {
  //   accessToken = await refreshXeroToken(tenantId, decryptToken(conn.refresh_token), req.user.id);
  // }

  try {
    // GET https://api.xero.com/api.xro/2.0/Reports/BASorGST
    // const reportRes = await axios.get(`${XERO.apiBase}/Reports/BASorGST`, {
    //   headers: {
    //     Authorization: `Bearer ${accessToken}`,
    //     'xero-tenant-id': tenantId,
    //     Accept: 'application/json',
    //   }
    // });
    // const report = reportRes.data.Reports[0];
    // const rows = parseXeroBASReport(report);

    // STUB response (matches real Xero BAS report structure)
    const rows = {
      G1_totalSales:     148500,
      G3_gstOnSales:      13500,
      G10_capitalItems:    2100,
      G11_gstOnCapital:     210,
      G20_totalPurchases:  46000,
      G21_gstOnPurchases:   4200,
      W1_paygWithheld:     12400,
      netPayable:           9510,  // G3 + G11 - G21
      refund: false,
    };

    res.json({
      reportId:   'BASorGST',
      period:     'Q3 FY2024–25',
      tenantId,
      rows,
      lastSynced: new Date().toISOString(),
    });
  } catch (err) {
    console.error('[Xero] Sync error:', err.response?.data || err.message);
    res.status(500).json({ error: 'BAS sync failed' });
  }
});

// ── ROUTE: Sync P&L ───────────────────────────────────────────────────────
// GET /api/xero/reports/pl/:tenantId
router.get('/reports/pl/:tenantId', requireAuth, async (req, res) => {
  const { tenantId } = req.params;
  const { fromDate, toDate } = req.query;
  // GET https://api.xero.com/api.xro/2.0/Reports/ProfitAndLoss?fromDate=...&toDate=...
  res.json({ revenue: 148500, expenses: 89200, netProfit: 59300 });
});

// ── HELPER: Parse Xero BAS report rows to our format ─────────────────────
function parseXeroBASReport(report) {
  const rows = {};
  const findCell = (rowTitle) => {
    for (const row of report.Rows || []) {
      for (const subRow of row.Rows || []) {
        if (subRow.Cells?.[0]?.Value === rowTitle) {
          return parseFloat(subRow.Cells?.[1]?.Value?.replace(/[^0-9.-]/g, '') || '0');
        }
      }
    }
    return 0;
  };
  rows.G1_totalSales     = findCell('G1 Total sales');
  rows.G3_gstOnSales     = findCell('G3 GST on sales');
  rows.G10_capitalItems  = findCell('G10 Capital purchases');
  rows.G11_gstOnCapital  = findCell('G11 GST on capital purchases');
  rows.G20_totalPurchases = findCell('G20 Total purchases');
  rows.G21_gstOnPurchases = findCell('G21 GST on purchases');
  rows.W1_paygWithheld   = findCell('W1 PAYG withheld');
  rows.netPayable = (rows.G3_gstOnSales + rows.G11_gstOnCapital) - rows.G21_gstOnPurchases;
  rows.refund = rows.netPayable < 0;
  return rows;
}

// ── HELPER: Refresh expired access token ─────────────────────────────────
async function refreshXeroToken(tenantId, refreshToken, userId) {
  const res = await axios.post(XERO.tokenUrl,
    new URLSearchParams({ grant_type: 'refresh_token', refresh_token: refreshToken }),
    { auth: { username: XERO.clientId, password: XERO.clientSecret } }
  );
  const { access_token, refresh_token: new_refresh, expires_in } = res.data;
  // await supabase.from('xero_connections').update({
  //   access_token:  encryptToken(access_token),
  //   refresh_token: encryptToken(new_refresh),
  //   expires_at:    new Date(Date.now() + expires_in * 1000).toISOString(),
  // }).eq('user_id', userId).eq('tenant_id', tenantId);
  return access_token;
}

module.exports = router;
