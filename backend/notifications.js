/**
 * ComplianceEase — Notification Service
 * ========================================
 * Email (via Resend) + SMS (via Twilio)
 *
 * SETUP:
 *   npm install resend twilio
 *
 *   Add to .env:
 *     RESEND_API_KEY=re_...        ← from resend.com (free tier: 3k emails/month)
 *     TWILIO_ACCOUNT_SID=AC...     ← from console.twilio.com
 *     TWILIO_AUTH_TOKEN=...
 *     TWILIO_FROM_NUMBER=+61...    ← buy an AU number in Twilio (~$1.50/month)
 *
 * MOUNT IN YOUR app.js:
 *   const notifRoutes = require('./backend/notifications');
 *   app.use('/api/notifications', notifRoutes);
 */

const express = require('express');
const router  = express.Router();

// ── RESEND (Email) ────────────────────────────────────────────────────────
// const { Resend } = require('resend');
// const resend = new Resend(process.env.RESEND_API_KEY);

// ── TWILIO (SMS) ──────────────────────────────────────────────────────────
// const twilio = require('twilio');
// const twilioClient = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);

// ── EMAIL TEMPLATES ────────────────────────────────────────────────────────
const emailTemplates = {
  reminder: ({ clientName, obligationType, daysUntil, dueDate, bookkeeper }) => ({
    subject: `Action required: ${obligationType} due ${daysUntil === 0 ? 'TODAY' : `in ${daysUntil} days`} — ${clientName}`,
    html: `
      <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; padding: 40px 20px;">
        <div style="background: #0c0e12; border-radius: 12px; padding: 24px; margin-bottom: 24px; text-align: center;">
          <span style="font-size: 24px; font-weight: 900; color: white; letter-spacing: -0.02em;">ComplianceEase</span>
        </div>
        <h2 style="color: #0c0e12;">Hello ${clientName},</h2>
        <p style="color: #505970; line-height: 1.7;">
          This is a reminder from ${bookkeeper || 'your bookkeeper'} that your 
          <strong>${obligationType}</strong> is due on <strong>${dueDate}</strong>
          ${daysUntil === 0 ? '— <strong style="color:#d63939">TODAY</strong>' : `(in ${daysUntil} days)`}.
        </p>
        <div style="background: ${daysUntil <= 3 ? '#fff5f5' : '#f0fdf4'}; border: 1px solid ${daysUntil <= 3 ? '#fecaca' : '#bbf7d0'}; 
          border-radius: 10px; padding: 16px 20px; margin: 20px 0;">
          <strong style="color: ${daysUntil <= 3 ? '#d63939' : '#16a34a'};">
            ${daysUntil === 0 ? '⚠️ Due today — please action immediately' : `✓ Due in ${daysUntil} days — please prepare`}
          </strong>
        </div>
        <p style="color: #505970; line-height: 1.7;">
          Please contact ${bookkeeper || 'us'} if you have any questions or need to provide information.
        </p>
        <hr style="border: none; border-top: 1px solid #e5e7eb; margin: 32px 0;">
        <p style="font-size: 12px; color: #9ca3af; text-align: center;">
          Sent by ComplianceEase · This is an automated compliance reminder · Not tax advice
        </p>
      </div>
    `
  }),
};

// ── ROUTE: Send Reminder ───────────────────────────────────────────────────
// POST /api/notifications/remind
router.post('/remind', async (req, res) => {
  const { clientId, type = 'email', daysUntil = 7 } = req.body;

  // Fetch client details from Supabase
  // const { data: client } = await supabase.from('clients').select('*').eq('id', clientId).single();
  // const { data: user } = await supabase.auth.getUser(req.headers.authorization?.split(' ')[1]);

  // STUB client data
  const client = { name: 'Smith Plumbing Pty Ltd', email: 'john@smithplumbing.com.au', phone: '+61412000000' };
  const bookkeeper = 'Karen Thompson';
  const obligationType = 'Quarterly BAS';
  const dueDate = '28 March 2025';

  try {
    if (type === 'email') {
      const tmpl = emailTemplates.reminder({ clientName: client.name, obligationType, daysUntil, dueDate, bookkeeper });
      
      // PRODUCTION:
      // await resend.emails.send({
      //   from: 'ComplianceEase <reminders@yourdomain.com.au>',
      //   to: client.email,
      //   subject: tmpl.subject,
      //   html: tmpl.html,
      // });
      
      console.log('[Notifications] Email sent to:', client.email);
    } else if (type === 'sms') {
      const body = `Hi ${client.name.split(' ')[0]}, your ${obligationType} is due ${daysUntil === 0 ? 'TODAY' : `in ${daysUntil} days`} (${dueDate}). Please contact ${bookkeeper}. – ComplianceEase`;
      
      // PRODUCTION:
      // await twilioClient.messages.create({
      //   body,
      //   from: process.env.TWILIO_FROM_NUMBER,
      //   to:   client.phone, // must be in E.164 format: +61412000000
      // });
      
      console.log('[Notifications] SMS sent to:', client.phone, '|', body);
    }

    // Log notification in Supabase audit log
    // await supabase.from('audit_log').insert({
    //   client_id: clientId,
    //   action:    `${type}_reminder_sent`,
    //   detail:    `${obligationType} — ${daysUntil} days until due`,
    //   user_id:   req.user.id,
    // });

    res.json({ success: true });
  } catch (err) {
    console.error('[Notifications] Error:', err);
    res.status(500).json({ error: 'Notification failed' });
  }
});

// ── AUTOMATED DAILY DIGEST ─────────────────────────────────────────────────
// Call this from a cron job: 0 9 * * * (9am daily AEST)
// In production: use Vercel Cron, Supabase Edge Functions, or a simple node-cron
async function sendDailyDigest(userId) {
  // Fetch all upcoming deadlines for this bookkeeper
  // const { data: deadlines } = await supabase.from('obligations')
  //   .select('*, client:clients(*)')
  //   .eq('user_id', userId)
  //   .eq('status', 'pending')
  //   .lte('due_date', new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString())
  //   .order('due_date');
  
  // Send digest email with all upcoming deadlines
  console.log('[Notifications] Daily digest sent for user:', userId);
}

module.exports = router;
module.exports.sendDailyDigest = sendDailyDigest;
