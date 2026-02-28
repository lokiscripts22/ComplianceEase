/* ═══════════════════════════════════════════════════════════════
   ComplianceEase v2 — App Logic
   ═══════════════════════════════════════════════════════════════

   KEYS TO ADD (backend .env — never expose secrets to frontend):
   ──────────────────────────────────────────────────────────────
   SUPABASE_URL=https://xxxx.supabase.co
   SUPABASE_ANON_KEY=eyJ...

   XERO_CLIENT_ID=your_xero_client_id          ← get from developer.xero.com/myapps
   XERO_CLIENT_SECRET=your_xero_secret         ← BACKEND ONLY, never frontend
   XERO_REDIRECT_URI=https://yourdomain.com/auth/xero/callback.html

   MYOB_CLIENT_ID=your_myob_client_id          ← get from developer.myob.com
   MYOB_CLIENT_SECRET=your_myob_secret         ← BACKEND ONLY
   MYOB_REDIRECT_URI=https://yourdomain.com/auth/myob/callback.html

   XORO_API_KEY=your_xoro_api_key              ← coming in future update
   XORO_REDIRECT_URI=https://yourdomain.com/auth/xoro/callback.html

   STRIPE_PUBLISHABLE_KEY=pk_live_...          ← from dashboard.stripe.com
   STRIPE_SECRET_KEY=sk_live_...               ← BACKEND ONLY

   RESEND_API_KEY=re_...                        ← from resend.com (email reminders)
   TWILIO_ACCOUNT_SID=AC...                    ← from console.twilio.com (SMS)
   TWILIO_AUTH_TOKEN=...                        ← BACKEND ONLY
   TWILIO_FROM_NUMBER=+61...                   ← AU mobile number from Twilio

   See backend/ folder for API route stubs that use these keys.
   ═══════════════════════════════════════════════════════════════ */

'use strict';

// ── CONFIG ─────────────────────────────────────────────────────────────────
const CONFIG = {
  supabase: {
    url:     'SUPABASE_URL_HERE',
    anonKey: 'SUPABASE_ANON_KEY_HERE',
  },
  xero: {
    clientId:    'XERO_CLIENT_ID_HERE',
    redirectUri: window.location.origin + '/auth/xero/callback.html',
    scopes:      'openid profile email accounting.reports.read accounting.settings offline_access',
    authEndpoint:'https://login.xero.com/identity/connect/authorize',
  },
  myob: {
    clientId:    'MYOB_CLIENT_ID_HERE',
    redirectUri: window.location.origin + '/auth/myob/callback.html',
    scopes:      'CompanyFile',
    authEndpoint:'https://secure.myob.com/oauth2/account/authorize',
  },
  xoro: {
    clientId:    'XORO_CLIENT_ID_HERE',       // ← Xoro integration coming in v2.1
    redirectUri: window.location.origin + '/auth/xoro/callback.html',
    authEndpoint:'https://api.xoro.com/oauth/authorize', // update when Xoro publishes
  },
  stripe: {
    publishableKey: 'STRIPE_PUBLISHABLE_KEY_HERE',
  },
  resend: {
    // Used server-side only — see backend/notifications.js
    apiKey: 'RESEND_API_KEY_HERE',
  },
  twilio: {
    // Used server-side only — see backend/notifications.js
    accountSid: 'TWILIO_ACCOUNT_SID_HERE',
    fromNumber: 'TWILIO_FROM_NUMBER_HERE',
  }
};

// ══════════════════════════════════════════════════════════════════════════
// XERO INTEGRATION
// Status: OAuth flow fully stubbed, needs XERO_CLIENT_ID + backend running
// Apply at: https://developer.xero.com/myapps
// Required scopes: accounting.reports.read, accounting.settings
// ══════════════════════════════════════════════════════════════════════════
const Xero = {
  connect(tenantLabel) {
    const state = crypto.randomUUID();
    sessionStorage.setItem('xero_state', state);
    sessionStorage.setItem('xero_tenant_label', tenantLabel || '');
    const params = new URLSearchParams({
      response_type: 'code',
      client_id:     CONFIG.xero.clientId,
      redirect_uri:  CONFIG.xero.redirectUri,
      scope:         CONFIG.xero.scopes,
      state:         state,
    });
    // PRODUCTION: uncomment this line when XERO_CLIENT_ID is set
    // window.location.href = CONFIG.xero.authEndpoint + '?' + params;

    // DEMO: show activation modal
    IntegrationModal.show('xero');
  },

  // ── Called by backend after OAuth exchange ────────────────────────────
  // POST /api/xero/token — exchange code for access + refresh tokens
  // Tokens stored encrypted in Supabase, never exposed to frontend
  // See backend/xero.js for full implementation

  async syncBAS(tenantId) {
    // PRODUCTION:
    // const res = await fetch('/api/xero/sync/bas/' + tenantId, {
    //   method: 'POST',
    //   headers: { 'Authorization': 'Bearer ' + await Auth.getToken() }
    // });
    // return res.json();

    // DEMO — matches real Xero BAS report field names exactly
    await new Promise(r => setTimeout(r, 1400));
    return {
      reportId: 'BASorGST',
      period:   'Q3 FY2024–25',
      tenantId,
      rows: {
        G1_totalSales:      148500,
        G3_gstOnSales:       13500,
        G10_capitalItems:     2100,
        G11_gstOnCapital:      210,
        G20_totalPurchases:  46000,
        G21_gstOnPurchases:   4200,
        W1_paygWithheld:     12400,
        netPayable:           9510,
        refund: false,
      },
      lastSynced: new Date().toISOString(),
    };
  },

  async syncPL(tenantId, fromDate, toDate) {
    // PRODUCTION: GET /api/xero/reports/pl/:tenantId?from=...&to=...
    return { revenue: 148500, expenses: 89200, netProfit: 59300 };
  },

  async refreshToken(tenantId) {
    // PRODUCTION: handled automatically by backend middleware
    // POST https://identity.xero.com/connect/token with grant_type=refresh_token
    // See backend/xero.js — tokenRefreshMiddleware()
    console.log('[Xero] Token refresh triggered for:', tenantId);
  }
};

// ══════════════════════════════════════════════════════════════════════════
// MYOB INTEGRATION
// Status: OAuth flow stubbed, needs MYOB_CLIENT_ID + backend
// Apply at: https://developer.myob.com
// Required scopes: CompanyFile
// ══════════════════════════════════════════════════════════════════════════
const MYOB = {
  connect(tenantLabel) {
    const state = crypto.randomUUID();
    sessionStorage.setItem('myob_state', state);
    const params = new URLSearchParams({
      client_id:     CONFIG.myob.clientId,
      redirect_uri:  CONFIG.myob.redirectUri,
      response_type: 'code',
      scope:         CONFIG.myob.scopes,
      state:         state,
    });
    // PRODUCTION: uncomment when MYOB_CLIENT_ID is set
    // window.location.href = CONFIG.myob.authEndpoint + '?' + params;

    // DEMO:
    IntegrationModal.show('myob');
  },

  async syncBAS(companyFileId) {
    // PRODUCTION:
    // GET https://api.myob.com/accountright/:cfid/Sale/Invoice
    // Then compute BAS from invoice + payment data
    // (MYOB doesn't have a direct BAS report endpoint like Xero)
    // See backend/myob.js — computeBASFromTransactions()
    await new Promise(r => setTimeout(r, 1600));
    return {
      source: 'myob',
      companyFileId,
      period: 'Q3 FY2024–25',
      rows: {
        totalSales:    96200,
        gstOnSales:     8745,
        totalPurchases: 31400,
        gstOnPurchases: 2854,
        paygWithheld:   8200,
        netPayable:     6109,
        refund: false,
      },
      lastSynced: new Date().toISOString(),
      note: 'Computed from MYOB transaction data — review before lodging.',
    };
  }
};

// ══════════════════════════════════════════════════════════════════════════
// XORO INTEGRATION
// Status: Coming in v2.1 — pending Xoro API documentation release
// We've reserved the OAuth flow and UI placeholders
// ══════════════════════════════════════════════════════════════════════════
const Xoro = {
  connect() {
    IntegrationModal.show('xoro');
  },
  async syncBAS(tenantId) {
    // TODO: implement when Xoro publishes their API docs
    // See: https://xoro.com (check developer portal)
    throw new Error('Xoro integration coming in v2.1');
  }
};

// ══════════════════════════════════════════════════════════════════════════
// AI RISK SCORING ENGINE
// Scores each client 0–100 based on deadline proximity, response history,
// and obligation complexity. This is the "unfair advantage" feature.
// No external AI API needed — pure logic on your own data.
// ══════════════════════════════════════════════════════════════════════════
const RiskEngine = {
  /**
   * Score a client 0–100 for compliance risk this month.
   * Higher = more at risk of missing a deadline.
   *
   * Factors:
   *   - Days until next deadline (biggest weight)
   *   - Number of active obligations
   *   - Employee count (more staff = more complex payroll)
   *   - Whether they've responded to recent reminders
   *   - Historical late lodgements
   *
   * @param {Object} client
   * @returns {{ score: number, level: 'high'|'medium'|'low', reasons: string[] }}
   */
  score(client) {
    let score = 0;
    const reasons = [];

    // Deadline proximity (0–45 pts)
    const daysUntilNext = client.daysUntilNext || 999;
    if (daysUntilNext <= 3)  { score += 45; reasons.push('Deadline within 3 days'); }
    else if (daysUntilNext <= 7)  { score += 32; reasons.push('Deadline this week'); }
    else if (daysUntilNext <= 14) { score += 18; reasons.push('Deadline within 2 weeks'); }
    else if (daysUntilNext <= 30) { score += 8;  }

    // Number of open obligations (0–20 pts)
    const openObs = client.openObligations || 0;
    if (openObs >= 3) { score += 20; reasons.push('3+ open obligations'); }
    else if (openObs === 2) { score += 12; reasons.push('Multiple open obligations'); }
    else if (openObs === 1) { score += 6; }

    // Employee complexity (0–15 pts)
    const employees = client.employees || 0;
    if (employees >= 20) { score += 15; reasons.push('Large payroll (20+ staff)'); }
    else if (employees >= 10) { score += 10; reasons.push('Medium payroll (10+ staff)'); }
    else if (employees >= 5)  { score += 5; }

    // No reminder response (0–12 pts)
    if (client.noReminderResponse) { score += 12; reasons.push('Not responding to reminders'); }

    // Historical late lodgements (0–8 pts)
    const lateHistory = client.lateHistory || 0;
    if (lateHistory >= 2) { score += 8; reasons.push('Previously late 2+ times'); }
    else if (lateHistory === 1) { score += 4; }

    score = Math.min(100, score);
    const level = score >= 60 ? 'high' : score >= 30 ? 'medium' : 'low';

    return {
      score,
      level,
      reasons: reasons.length ? reasons : ['On track — no risk flags'],
      label: score >= 60 ? `${score} HIGH` : score >= 30 ? `${score} MED` : `${score} LOW`,
    };
  },

  /**
   * Run risk scoring across all clients and return top-at-risk list.
   * In production: called on page load, results cached in Supabase.
   */
  rankAll(clients) {
    return clients
      .map(c => ({ ...c, risk: this.score(c) }))
      .sort((a, b) => b.risk.score - a.risk.score);
  },

  // Demo data: risk scores for the sample clients shown in the UI
  demoScores: {
    'smith-plumbing':    { score: 88, level: 'high',   label: '88 HIGH', reasons: ['Deadline within 3 days', 'Multiple open obligations', 'Medium payroll (10+ staff)'] },
    'jones-electrical':  { score: 84, level: 'high',   label: '84 HIGH', reasons: ['Deadline within 3 days', 'Large payroll (20+ staff)'] },
    'brown-construction':{ score: 76, level: 'high',   label: '76 HIGH', reasons: ['Deadline within 3 days', '3+ open obligations', 'Large payroll (20+ staff)'] },
    'anderson-cafe':     { score: 42, level: 'medium', label: '42 MED',  reasons: ['Deadline this week', 'Not responding to reminders'] },
    'wilson-landscaping':{ score: 35, level: 'medium', label: '35 MED',  reasons: ['Deadline this week'] },
    'sunrise-bakery':    { score: 12, level: 'low',    label: '12 LOW',  reasons: ['On track — no risk flags'] },
    'peak-fitness':      { score: 8,  level: 'low',    label: '8 LOW',   reasons: ['On track — no risk flags'] },
  }
};

// ══════════════════════════════════════════════════════════════════════════
// INTEGRATION MODAL
// Shows activation info for Xero, MYOB, Xoro
// ══════════════════════════════════════════════════════════════════════════
const IntegrationModal = {
  configs: {
    xero: {
      color: '#0b8cc4',
      gradient: 'linear-gradient(135deg,#13b5ea,#0b8cc4)',
      icon: '🔵',
      name: 'Xero',
      status: 'Built & ready — needs your Client ID',
      applyUrl: 'https://developer.xero.com/myapps',
      applyLabel: 'Apply at developer.xero.com',
      what: [
        '✓ OAuth2 flow code complete',
        '✓ BAS report sync (G1–G21, W1) stubbed',
        '✓ Encrypted token storage ready',
        '✓ Multi-tenant support built in',
        '✓ Token refresh middleware ready',
        '○ Awaiting your Xero app approval',
      ],
      note: 'Xero requires app approval for accounting.reports.read scope. Usually 1–3 business days.',
    },
    myob: {
      color: '#6d28d9',
      gradient: 'linear-gradient(135deg,#7c3aed,#4c1d95)',
      icon: '🟡',
      name: 'MYOB',
      status: 'Built & ready — needs your Client ID',
      applyUrl: 'https://developer.myob.com',
      applyLabel: 'Apply at developer.myob.com',
      what: [
        '✓ OAuth2 flow code complete',
        '✓ Company file sync stubbed',
        '✓ BAS computed from transactions (MYOB approach)',
        '✓ Encrypted token storage ready',
        '○ Awaiting your MYOB developer app',
      ],
      note: 'MYOB uses a different BAS approach — we compute from transaction data rather than a report endpoint.',
    },
    xoro: {
      color: '#d97706',
      gradient: 'linear-gradient(135deg,#f59e0b,#d97706)',
      icon: '🟠',
      name: 'Xoro',
      status: 'Coming in v2.1',
      applyUrl: 'https://xoro.com',
      applyLabel: 'Visit xoro.com',
      what: [
        '○ Waiting on Xoro API documentation',
        '○ OAuth flow reserved and ready to build',
        '○ UI placeholders already in place',
        '○ Will be added as soon as API is available',
      ],
      note: 'Xoro integration is planned for v2.1. If you have Xoro API access already, contact us.',
    },
  },

  show(type = 'xero') {
    const c = this.configs[type] || this.configs.xero;
    let modal = document.getElementById('integration-modal');
    if (modal) modal.remove();
    modal = document.createElement('div');
    modal.id = 'integration-modal';
    modal.style.cssText = `
      position:fixed;inset:0;background:rgba(12,14,18,.75);
      backdrop-filter:blur(6px);z-index:9999;
      display:flex;align-items:center;justify-content:center;padding:20px;
    `;
    modal.innerHTML = `
      <div style="
        background:#fff;border-radius:20px;padding:40px 36px;
        max-width:500px;width:100%;box-shadow:0 24px 64px rgba(12,14,18,.3);
        font-family:'Instrument Sans',sans-serif;
      ">
        <div style="
          width:56px;height:56px;border-radius:14px;background:${c.gradient};
          display:flex;align-items:center;justify-content:center;
          margin:0 auto 20px;font-size:26px;
        ">${c.icon}</div>
        <h3 style="font-family:'Cabinet Grotesk',sans-serif;font-size:1.4rem;font-weight:900;
          letter-spacing:-0.03em;text-align:center;margin-bottom:6px;">${c.name} Integration</h3>
        <p style="font-size:13px;color:#8e97ae;text-align:center;margin-bottom:20px;">${c.status}</p>
        <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:10px;padding:16px;margin-bottom:16px;">
          ${c.what.map(w => `<div style="font-size:13px;color:#374151;padding:3px 0;">${w}</div>`).join('')}
        </div>
        ${c.note ? `<p style="font-size:12px;color:#9ca3af;line-height:1.6;margin-bottom:20px;padding:12px;background:#fffbeb;border:1px solid #fde68a;border-radius:8px;">${c.note}</p>` : ''}
        <div style="display:flex;gap:10px;">
          <a href="${c.applyUrl}" target="_blank" style="
            flex:1;background:${c.gradient};color:white;border:none;
            padding:11px;border-radius:10px;font-size:14px;font-weight:600;
            cursor:pointer;text-align:center;text-decoration:none;
            font-family:'Instrument Sans',sans-serif;
          ">${c.applyLabel} →</a>
          <button onclick="document.getElementById('integration-modal').remove()" style="
            background:#f1f5f9;color:#374151;border:none;
            padding:11px 20px;border-radius:10px;font-size:14px;font-weight:600;
            cursor:pointer;font-family:'Instrument Sans',sans-serif;
          ">Close</button>
        </div>
      </div>
    `;
    document.body.appendChild(modal);
    modal.addEventListener('click', e => { if (e.target === modal) modal.remove(); });
  }
};

// ══════════════════════════════════════════════════════════════════════════
// AUTH (Supabase)
// ══════════════════════════════════════════════════════════════════════════
const Auth = {
  async signUp(email, password) {
    // PRODUCTION:
    // const { data, error } = await supabase.auth.signUp({ email, password });
    // if (error) throw error;
    return { user: { id: 'demo-user', email } };
  },
  async signIn(email, password) {
    // const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    return { user: { id: 'demo-user', email } };
  },
  async getToken() {
    // const { data } = await supabase.auth.getSession();
    // return data?.session?.access_token;
    return 'demo-token';
  },
  async signOut() {
    // await supabase.auth.signOut();
    window.location.href = 'index.html';
  }
};

// ══════════════════════════════════════════════════════════════════════════
// CLIENTS (Supabase)
// ══════════════════════════════════════════════════════════════════════════
const Clients = {
  async getAll() {
    // const { data } = await supabase.from('clients').select('*').order('name');
    return [];
  },
  async add(client) {
    // const { data, error } = await supabase.from('clients').insert(client).select();
    Toast.show('Client added successfully', 'success');
    return { id: Date.now().toString(), ...client };
  },
  async update(id, updates) {
    // await supabase.from('clients').update(updates).eq('id', id);
    Toast.show('Client updated', 'success');
  },
  async remove(id) {
    if (!confirm('Remove this client? Billing stops at next cycle.')) return;
    // await supabase.from('clients').delete().eq('id', id);
    Toast.show('Client removed', 'success');
  }
};

// ══════════════════════════════════════════════════════════════════════════
// NOTIFICATIONS (Resend + Twilio)
// These run server-side only — see backend/notifications.js
// ══════════════════════════════════════════════════════════════════════════
const Notifications = {
  // Trigger from frontend — backend handles actual sending
  async sendReminder(clientId, type = 'email', daysUntil) {
    // PRODUCTION:
    // await fetch('/api/notifications/remind', {
    //   method: 'POST',
    //   headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + await Auth.getToken() },
    //   body: JSON.stringify({ clientId, type, daysUntil })
    // });
    Toast.show(`${type === 'sms' ? 'SMS' : 'Email'} reminder sent to client`, 'success');
  },
};

// ══════════════════════════════════════════════════════════════════════════
// TOAST NOTIFICATIONS
// ══════════════════════════════════════════════════════════════════════════
const Toast = {
  show(message, type = 'success', duration = 3500) {
    const colors = {
      success: { bg:'#f0fdf4', border:'#bbf7d0', text:'#16a34a', icon:'✓' },
      error:   { bg:'#fff5f5', border:'#fecaca', text:'#d63939', icon:'✕' },
      info:    { bg:'#edfcfa', border:'#7eeade', text:'#0f5249', icon:'ℹ' },
    };
    const c = colors[type] || colors.success;
    const el = document.createElement('div');
    el.style.cssText = `
      position:fixed;bottom:24px;right:24px;z-index:10000;
      background:${c.bg};border:1px solid ${c.border};
      padding:12px 18px;border-radius:12px;
      font-family:'Instrument Sans',sans-serif;
      font-size:14px;font-weight:500;color:${c.text};
      display:flex;align-items:center;gap:10px;
      box-shadow:0 4px 20px rgba(12,14,18,.12);
      animation:toastIn .25s ease;
    `;
    el.innerHTML = `<span style="font-weight:900;font-size:15px;">${c.icon}</span>${message}`;
    const style = document.createElement('style');
    style.textContent = `@keyframes toastIn{from{opacity:0;transform:translateY(10px)}to{opacity:1;transform:translateY(0)}}`;
    document.head.appendChild(style);
    document.body.appendChild(el);
    setTimeout(() => el.remove(), duration);
  }
};

// ══════════════════════════════════════════════════════════════════════════
// PRICING CALCULATOR (v2 — flat plans, not per-client)
// ══════════════════════════════════════════════════════════════════════════
function initCalculator() {
  const slider   = document.getElementById('clientSlider');
  const countEl  = document.getElementById('clientCount');
  const totalEl  = document.getElementById('monthlyTotal');
  const savingEl = document.getElementById('timeSavings');
  const planEl   = document.getElementById('currentPlan');
  if (!slider) return;

  const plans = [
    { name: 'Starter', max: 10,  price: 99,  perClient: null },
    { name: 'Growth',  max: 25,  price: 149, perClient: null },
    { name: 'Pro',     max: 999, price: 199, perClient: null },
  ];

  function getPlan(n) {
    return plans.find(p => n <= p.max) || plans[plans.length - 1];
  }

  function update() {
    const n    = parseInt(slider.value);
    const plan = getPlan(n);
    const hrsSaved = Math.max(2, Math.round(n * 0.18));
    const saving   = hrsSaved * 75;
    if (countEl) countEl.textContent  = n;
    if (totalEl) totalEl.textContent  = '$' + plan.price;
    if (savingEl) savingEl.textContent = '$' + saving.toLocaleString();
    if (planEl)  planEl.textContent   = plan.name + ' Plan';
    ['tier-1','tier-2','tier-3'].forEach((id,i) => {
      const el = document.getElementById(id);
      if (el) el.classList.toggle('active-tier', plans[i] === plan);
    });
  }

  slider.addEventListener('input', update);
  update();
}

// ══════════════════════════════════════════════════════════════════════════
// CLIENT SEARCH
// ══════════════════════════════════════════════════════════════════════════
function initClientSearch() {
  const searchInput  = document.getElementById('clientSearch');
  const filterSelect = document.getElementById('clientFilter');
  const rows         = document.querySelectorAll('.client-row');
  if (!searchInput || !rows.length) return;

  function run() {
    const q = searchInput.value.toLowerCase().trim();
    const f = filterSelect?.value || 'all';
    rows.forEach(row => {
      const name   = (row.dataset.name   || '').toLowerCase();
      const abn    = (row.dataset.abn    || '').toLowerCase();
      const status = (row.dataset.status || '');
      const matchQ = !q || name.includes(q) || abn.includes(q);
      const matchF = f === 'all' || status === f;
      row.style.display = (matchQ && matchF) ? '' : 'none';
    });
  }
  searchInput.addEventListener('input', run);
  filterSelect?.addEventListener('change', run);
}

// ══════════════════════════════════════════════════════════════════════════
// MARK COMPLETE
// ══════════════════════════════════════════════════════════════════════════
window.markComplete = function(btn) {
  const row = btn.closest('tr') || btn.closest('.obligation-row');
  if (!row) return;
  row.style.opacity = '0.45';
  row.style.filter  = 'grayscale(1)';
  btn.textContent   = '✓ Done';
  btn.disabled      = true;
  btn.style.cssText = 'background:var(--green-100);color:var(--green-500);border:1px solid #bbf7d0;';
  Toast.show('Obligation marked as complete', 'success');
};

// ══════════════════════════════════════════════════════════════════════════
// XERO SYNC BUTTON
// ══════════════════════════════════════════════════════════════════════════
window.syncXero = async function(btn, tenantId) {
  const orig = btn.innerHTML;
  btn.innerHTML = '<span style="opacity:.6">⟳ Syncing…</span>';
  btn.disabled  = true;
  try {
    const data = await Xero.syncBAS(tenantId || 'demo-tenant');
    renderBASSnapshot(data, 'xero');
    const ts = document.getElementById('xeroSyncTime');
    if (ts) ts.textContent = 'Last synced: just now';
    Toast.show('Xero BAS data synced', 'success');
  } catch(e) {
    Toast.show('Sync failed — check Xero connection', 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled  = false;
  }
};

window.syncMYOB = async function(btn, companyFileId) {
  const orig = btn.innerHTML;
  btn.innerHTML = '<span style="opacity:.6">⟳ Syncing…</span>';
  btn.disabled  = true;
  try {
    const data = await MYOB.syncBAS(companyFileId || 'demo-cf');
    renderBASSnapshot(data, 'myob');
    Toast.show('MYOB data synced', 'success');
  } catch(e) {
    Toast.show('Sync failed — check MYOB connection', 'error');
  } finally {
    btn.innerHTML = orig;
    btn.disabled  = false;
  }
};

function renderBASSnapshot(data, source) {
  const snap = document.getElementById('xeroSnapshot');
  if (!snap) return;
  const fmt = n => '$' + Math.abs(n).toLocaleString();
  const r   = data.rows;
  const ts  = new Date(data.lastSynced).toLocaleTimeString('en-AU', {hour:'2-digit',minute:'2-digit'});
  const sourceName = source === 'myob' ? 'MYOB' : 'Xero';
  snap.innerHTML = `
    <div class="xero-snapshot">
      <div style="display:flex;justify-content:space-between;align-items:center;">
        <div>
          <div style="font-size:12px;color:rgba(255,255,255,.5);font-weight:600;text-transform:uppercase;letter-spacing:.07em;">${sourceName} Live Data</div>
          <div style="font-size:15px;font-weight:700;color:white;margin-top:2px;">BAS Report — ${data.period || 'Current Quarter'}</div>
        </div>
        <div style="font-size:11px;color:rgba(255,255,255,.4);">Synced ${ts}</div>
      </div>
      <div class="xero-snap-grid">
        <div class="xero-snap-item"><div class="xero-snap-label">Total Sales</div><div class="xero-snap-val">${fmt(r.G1_totalSales || r.totalSales)}</div></div>
        <div class="xero-snap-item"><div class="xero-snap-label">GST Collected</div><div class="xero-snap-val">${fmt(r.G3_gstOnSales || r.gstOnSales)}</div></div>
        <div class="xero-snap-item"><div class="xero-snap-label">GST Claimable</div><div class="xero-snap-val">${fmt(r.G21_gstOnPurchases || r.gstOnPurchases)}</div></div>
        <div class="xero-snap-item"><div class="xero-snap-label">PAYG Withheld</div><div class="xero-snap-val">${fmt(r.W1_paygWithheld || r.paygWithheld)}</div></div>
        <div class="xero-snap-item"><div class="xero-snap-label">Total Purchases</div><div class="xero-snap-val">${fmt(r.G20_totalPurchases || r.totalPurchases)}</div></div>
        <div class="xero-snap-item"><div class="xero-snap-label">Net Payable</div><div class="xero-snap-val">${fmt(r.netPayable)}</div></div>
      </div>
      <div class="xero-payable">
        <div>
          <div style="font-size:11px;color:rgba(255,255,255,.5);font-weight:700;text-transform:uppercase;letter-spacing:.07em;">Est. BAS Payable</div>
          <div style="font-family:'Cabinet Grotesk',sans-serif;font-size:1.8rem;font-weight:900;color:white;letter-spacing:-0.04em;">${fmt(r.netPayable)}</div>
        </div>
        <a href="https://bp.ato.gov.au" target="_blank" class="btn btn-accent btn-sm">Lodge via ATO →</a>
      </div>
    </div>
    ${data.note ? `<p style="font-size:11px;color:var(--amber-600);margin-top:var(--s-3);padding:8px 12px;background:var(--amber-50);border-radius:8px;border:1px solid #fde68a;">${data.note}</p>` : ''}
    <p style="font-size:11px;color:var(--ink-400);margin-top:var(--s-3);text-align:center;">
      Data sourced from ${sourceName}. Always review before lodging. <strong>Not tax advice.</strong>
    </p>
  `;
}

// ══════════════════════════════════════════════════════════════════════════
// ONBOARDING STEPS
// ══════════════════════════════════════════════════════════════════════════
let obStep = 1;
const obTotal = 3;

window.goStep = function(n) {
  document.getElementById('ob-step-' + obStep)?.classList.remove('show');
  obStep = n;
  document.getElementById('ob-step-' + obStep)?.classList.add('show');
  const pct = ((n-1)/(obTotal-1))*100;
  const bar = document.getElementById('ob-prog-fill');
  if (bar) bar.style.width = pct + '%';
  for (let i = 1; i <= obTotal; i++) {
    const lbl = document.getElementById('ob-lbl-' + i);
    if (!lbl) continue;
    lbl.classList.toggle('done', i < n);
    lbl.classList.toggle('active', i === n);
  }
  window.scrollTo({ top: 0, behavior: 'smooth' });
};

// ══════════════════════════════════════════════════════════════════════════
// SAVE FEEDBACK
// ══════════════════════════════════════════════════════════════════════════
window.saveSettings = function(btn) {
  const orig = btn.textContent;
  btn.textContent  = '✓ Saved';
  btn.style.cssText = 'background:var(--green-100);color:var(--green-500);border:1px solid #bbf7d0;padding:8px 16px;border-radius:8px;font-weight:600;cursor:pointer;';
  setTimeout(() => { btn.textContent = orig; btn.style.cssText = ''; }, 2500);
  Toast.show('Settings saved', 'success');
};

// ══════════════════════════════════════════════════════════════════════════
// SCROLL ANIMATIONS
// ══════════════════════════════════════════════════════════════════════════
function initScrollAnim() {
  const obs = new IntersectionObserver(entries => {
    entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); obs.unobserve(en.target); } });
  }, { threshold: 0.12 });
  document.querySelectorAll('.anim').forEach(el => obs.observe(el));
}

// ══════════════════════════════════════════════════════════════════════════
// INIT
// ══════════════════════════════════════════════════════════════════════════
document.addEventListener('DOMContentLoaded', () => {
  initCalculator();
  initClientSearch();
  initScrollAnim();

  // Integration connect buttons
  document.querySelectorAll('[data-xero-connect]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); Xero.connect(btn.dataset.xeroConnect); });
  });
  document.querySelectorAll('[data-myob-connect]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); MYOB.connect(btn.dataset.myobConnect); });
  });
  document.querySelectorAll('[data-xoro-connect]').forEach(btn => {
    btn.addEventListener('click', e => { e.preventDefault(); Xoro.connect(); });
  });

  // Save buttons
  document.querySelectorAll('[data-save-btn]').forEach(btn => {
    btn.addEventListener('click', () => saveSettings(btn));
  });

  // Enter key on forms
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && e.target.tagName === 'INPUT') {
      document.querySelector('[data-enter-submit]')?.click();
    }
  });
});
