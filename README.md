# ComplianceEase v3
### Australian bookkeeping compliance software — AI sidekick edition

> *"AI isn't taking your job. It's your sidekick."*

---

## What's in v3

| Feature | File | Status |
|---|---|---|
| AI Email Composer | `ai-emails.html` + `backend/ai-emails.js` | ✅ Built — needs ANTHROPIC_API_KEY |
| Client Portal (bookkeeper view) | `portal-manager.html` | ✅ Built — needs Supabase |
| Client Portal (client-facing) | `portal/client.html` | ✅ Built — needs Supabase |
| Photo upload (tradie-friendly) | `portal/client.html` + `backend/portal.js` | ✅ Built — ATO compliant |
| BAS approval workflow | `portal/client.html` + `backend/portal.js` | ✅ Built |
| Xero OAuth + BAS sync | `backend/xero.js` | ✅ Built — needs XERO_CLIENT_ID |
| MYOB OAuth + BAS sync | `backend/myob.js` | ✅ Built — needs MYOB_CLIENT_ID |
| AI Risk Scoring | `js/app.js` RiskEngine | ✅ Built — no API key needed |
| Email reminders | `backend/notifications.js` | ✅ Built — needs RESEND_API_KEY |
| SMS reminders | `backend/notifications.js` | ✅ Built — needs TWILIO keys |

---

## 5-minute launch

```bash
# Push to GitHub
git init && git add . && git commit -m "v3 — AI sidekick edition"
git remote add origin https://github.com/YOUR_USERNAME/ComplianceEase.git
git push -u origin main
```

Then: GitHub Settings → Pages → Source: main / root

---

## Activate in this order

1. **Anthropic** (console.anthropic.com) → `ANTHROPIC_API_KEY` → ~$5-15/mo
2. **Supabase** (supabase.com, ap-southeast-2 Sydney) → `SUPABASE_URL` + `SUPABASE_ANON_KEY`
3. **Resend** (resend.com, free 3k/mo) → `RESEND_API_KEY`
4. **Xero** (developer.xero.com/myapps) → `XERO_CLIENT_ID` + `XERO_CLIENT_SECRET`
5. **MYOB** (developer.myob.com) → `MYOB_CLIENT_ID` + `MYOB_CLIENT_SECRET`
6. **Twilio** (console.twilio.com) → SMS keys + AU number (~$2/mo)
7. **Stripe** (dashboard.stripe.com) → billing keys

## Monthly cost at 5 clients: ~$7-17. Revenue: $745. You're profitable from day one.

---

## Architecture

```
ComplianceEase-v3/
├── index.html              ← Landing — "AI isn't taking your job, it's your sidekick"
├── dashboard.html          ← Dashboard + AI risk radar
├── clients.html            ← All clients with risk + portal status
├── client-detail.html      ← Per-client + Xero/MYOB sync
├── alerts.html             ← Deadlines by urgency
├── ai-emails.html          ← AI email composer ✨ NEW
├── portal-manager.html     ← Bookkeeper portal controls ✨ NEW
├── portal/client.html      ← Client-facing portal ✨ NEW
├── reports.html / documents.html / settings.html / pricing.html
├── backend/
│   ├── server.js           ← All routes wired
│   ├── xero.js / myob.js   ← OAuth + BAS sync
│   ├── notifications.js    ← Email + SMS
│   ├── ai-emails.js        ← Claude AI email generation ✨ NEW
│   └── portal.js           ← Magic links + uploads + approval ✨ NEW
└── .env.example            ← All 17 keys documented
```

## Photo uploads — tradie friendly, ATO compliant

Clients can photograph receipts from their phone. Portal accepts jpg/png/heic/pdf. Photos flagged for bookkeeper quality review. One-click accept or request better copy. ATO accepts digital images under record-keeping rules (legible, kept 5 years).

## Get first 5 clients

Post in ICB Australia Facebook group + Australian Bookkeepers Network. Offer 3 months free for beta feedback. Do NOT build more features until someone pays you.

---
*ComplianceEase v3 — giving bookkeepers their evenings back.*
