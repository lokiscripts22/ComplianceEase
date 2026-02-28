/**
 * ComplianceEase — AI Email Generator
 * ======================================
 * Uses Claude (Anthropic) to write personalised client emails.
 *
 * SETUP:
 *   npm install @anthropic-ai/sdk
 *   Add to .env: ANTHROPIC_API_KEY=sk-ant-...
 *   Get key at: https://console.anthropic.com
 *
 * COST: ~$0.003–0.008 per email at Claude Haiku pricing.
 * At 200 emails/month = ~$1.50. Essentially free at MVP scale.
 *
 * MOUNT IN server.js:
 *   app.use('/api/ai-emails', require('./ai-emails'));
 */

const express   = require('express');
const Anthropic  = require('@anthropic-ai/sdk');
const router    = express.Router();

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// ── EMAIL TYPE PROMPTS ─────────────────────────────────────────────────────
const emailPrompts = {
  'deadline-reminder': ({ client, tone }) =>
    `Write a ${tone} email to ${client.contact} at ${client.name} (ABN: ${client.abn}) reminding them their ${client.deadline}. They use ${client.software} and have ${client.employees} employees. Keep it concise, professional, action-oriented. End with your bookkeeper's sign-off.`,

  'urgent-overdue': ({ client, tone }) =>
    `Write a ${tone} but professional urgent email to ${client.contact} at ${client.name}. Their ${client.deadline} — this is critical as ATO penalties may apply. You need them to act TODAY. Be direct but not rude. They use ${client.software}.`,

  'doc-request': ({ client, tone, extraContext }) =>
    `Write a ${tone} email to ${client.contact} at ${client.name} requesting documents needed for their upcoming ${client.deadline}. Mention that photos are fine (ATO accepts digital copies). ${extraContext ? `Also mention: ${extraContext}.` : ''} List the most likely documents needed for a business with ${client.employees} employees using ${client.software}.`,

  'bas-ready': ({ client, tone }) =>
    `Write a ${tone} email to ${client.contact} at ${client.name} letting them know their BAS is ready for review and approval. They need to log into their client portal to approve it before you can lodge. ${client.deadline}. Keep it simple and clear — don't use accounting jargon.`,

  'eofy-prep': ({ client, tone }) =>
    `Write a ${tone} EOFY preparation email to ${client.contact} at ${client.name}. They have ${client.employees} employees and use ${client.software}. Cover the key things they need to get in order before 30 June. Keep it practical and not overwhelming.`,

  'overdue-notice': ({ client, tone }) =>
    `Write a ${tone} overdue notice email to ${client.contact} at ${client.name}. Their obligation is now overdue: ${client.deadline}. Be professional but firm — this needs to be actioned today. Don't be aggressive but make the urgency clear.`,

  'welcome': ({ client, tone }) =>
    `Write a warm ${tone} welcome email to ${client.contact} who just joined the practice as ${client.name}. They use ${client.software} and have ${client.employees} employees. Explain how you'll work together, mention the client portal, and what to expect. Make them feel confident they're in good hands.`,

  'missing-info': ({ client, tone, extraContext }) =>
    `Write a ${tone} follow-up email to ${client.contact} at ${client.name}. You're still waiting on information before you can proceed with their ${client.deadline}. ${extraContext ? extraContext : 'It\'s the second chase.'} Mention they can use the client portal to upload documents or photos. Be polite but persistent.`,

  'good-news': ({ client, tone }) =>
    `Write a short, warm ${tone} email to ${client.contact} at ${client.name} letting them know their ${client.deadline.split(' ')[0]} has been successfully lodged with the ATO. Everything went through fine. Keep it brief and positive.`,
};

// ── ROUTE: Generate email ──────────────────────────────────────────────────
// POST /api/ai-emails/generate
router.post('/generate', async (req, res) => {
  const { client, emailType, tone = 'professional', extraContext } = req.body;

  if (!client || !emailType) {
    return res.status(400).json({ error: 'client and emailType required' });
  }

  const promptFn = emailPrompts[emailType];
  if (!promptFn) {
    return res.status(400).json({ error: 'Unknown email type' });
  }

  const userPrompt = promptFn({ client, tone, extraContext });

  const systemPrompt = `You are an expert Australian bookkeeper's assistant. Write professional, warm, and concise client emails for an Australian bookkeeping practice. 

Rules:
- Always address the client by first name
- Keep emails under 200 words unless it's EOFY prep (can be longer)  
- Never use accounting jargon clients won't understand
- Always end with a friendly sign-off like "Kind regards, [Your Bookkeeper]" on its own line
- Mention the client portal for document uploads when relevant
- Always include a brief disclaimer: "This is not tax advice" at the very bottom in small text, prefixed by ---
- Write for an Australian audience (use "BAS" not "VAT", "super" not "pension", etc.)
- If the email type is urgent, make the subject line and opening punchy but not alarming
- Tone variations: professional = formal but warm | friendly = conversational | firm = direct | casual = relaxed`;

  try {
    const message = await anthropic.messages.create({
      model: 'claude-haiku-4-5-20251001', // Fast + cheap for email generation
      max_tokens: 600,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const emailText = message.content[0]?.text || '';

    // Log to Supabase for sent history
    // await supabase.from('email_log').insert({
    //   user_id:    req.user.id,
    //   client_id:  client.id,
    //   email_type: emailType,
    //   tone,
    //   generated:  emailText,
    //   tokens_used: message.usage.input_tokens + message.usage.output_tokens,
    // });

    res.json({ email: emailText, tokensUsed: message.usage });
  } catch (err) {
    console.error('[AI Emails] Generation error:', err);
    res.status(500).json({ error: 'Email generation failed' });
  }
});

// ── ROUTE: Send email (via Resend) ─────────────────────────────────────────
// POST /api/ai-emails/send
router.post('/send', async (req, res) => {
  const { to, subject, body, clientId } = req.body;

  // PRODUCTION:
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from: 'Your Practice <reminders@yourdomain.com.au>',
  //   to,
  //   subject,
  //   text: body,
  //   html: body.replace(/\n/g, '<br>'),
  // });

  // Log sent email
  // await supabase.from('email_log').update({ sent_at: new Date().toISOString(), sent_to: to }).eq('client_id', clientId).is('sent_at', null);

  console.log('[AI Emails] Email sent to:', to, 'Subject:', subject);
  res.json({ success: true });
});

module.exports = router;
