/**
 * ComplianceEase — Client Portal Backend
 * =========================================
 * Magic link auth, document uploads (inc. photos), BAS approval, messaging.
 *
 * SETUP:
 *   npm install @supabase/supabase-js multer sharp uuid
 *   Supabase Storage bucket: create 'client-documents' (private)
 *
 * MOUNT IN server.js:
 *   app.use('/api/portal', require('./portal'));
 */

const express = require('express');
const multer  = require('multer');
const crypto  = require('crypto');
const router  = express.Router();

// multer — handle file uploads including photos
// Accepts: images (jpg/png/heic/webp), PDF, Excel, CSV
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB max
  fileFilter: (req, file, cb) => {
    const allowed = [
      'image/jpeg', 'image/png', 'image/heic', 'image/webp',
      'application/pdf',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'text/csv',
    ];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('File type not supported'));
  }
});

// ── ROUTE: Generate magic link for client ─────────────────────────────────
// POST /api/portal/invite
// Generates a unique magic link token, emails it to the client
router.post('/invite', async (req, res) => {
  const { clientId, clientEmail, clientName } = req.body;

  const token   = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 days

  // Store token in Supabase
  // await supabase.from('portal_tokens').upsert({
  //   client_id:  clientId,
  //   token,
  //   expires_at: expires.toISOString(),
  //   active:     true,
  // }, { onConflict: 'client_id' });

  const portalUrl = `${process.env.FRONTEND_URL}/portal/client.html?token=${token}`;

  // Send invite email via Resend
  // const { Resend } = require('resend');
  // const resend = new Resend(process.env.RESEND_API_KEY);
  // await resend.emails.send({
  //   from:    'Your Practice <noreply@yourdomain.com.au>',
  //   to:      clientEmail,
  //   subject: 'Your secure compliance portal is ready',
  //   html: `
  //     <p>Hi ${clientName},</p>
  //     <p>Your bookkeeper has set up a secure portal where you can:</p>
  //     <ul>
  //       <li>See your upcoming compliance deadlines</li>
  //       <li>Upload documents (photos are fine!)</li>
  //       <li>Approve your BAS before lodging</li>
  //       <li>Message your bookkeeper directly</li>
  //     </ul>
  //     <p><a href="${portalUrl}" style="background:#1aad9d;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Open My Portal →</a></p>
  //     <p style="font-size:12px;color:#9ca3af;">This link expires in 30 days. Powered by ComplianceEase.</p>
  //   `
  // });

  console.log('[Portal] Invite sent to:', clientEmail, 'URL:', portalUrl);
  res.json({ success: true, portalUrl });
});

// ── ROUTE: Verify portal token ─────────────────────────────────────────────
// GET /api/portal/verify?token=xxx
// Client visits their portal — we verify the token and return their data
router.get('/verify', async (req, res) => {
  const { token } = req.query;
  if (!token) return res.status(401).json({ error: 'No token' });

  // const { data: tokenRecord } = await supabase.from('portal_tokens')
  //   .select('*, client:clients(*)').eq('token', token).single();
  // if (!tokenRecord || new Date(tokenRecord.expires_at) < new Date()) {
  //   return res.status(401).json({ error: 'Link expired' });
  // }

  // STUB: return demo client data
  res.json({
    client: {
      id:        'smith-demo',
      name:      'Smith Plumbing Pty Ltd',
      contact:   'John Smith',
      abn:       '12 345 678 901',
      bookkeeper:'Your Practice',
    },
    deadlines: [
      { name: 'Quarterly BAS — Q3', type: 'BAS', dueDate: '2025-03-28', daysUntil: 0, status: 'pending' },
      { name: 'PAYG Withholding', type: 'PAYG', dueDate: '2025-03-30', daysUntil: 2, status: 'pending' },
    ],
    documentRequests: [
      { id: 'req1', title: 'Payroll Summary — March 2025', status: 'waiting' },
      { id: 'req2', title: 'Bank Statements — Q3',        status: 'received' },
    ],
    basForApproval: {
      period:   'Q3 FY2024–25',
      totalSales: 148500,
      gstOnSales:  13500,
      gstClaimable: 4200,
      paygWithheld: 12400,
      netPayable:   9510,
    },
  });
});

// ── ROUTE: Upload document / photo ─────────────────────────────────────────
// POST /api/portal/upload
// Handles both PDF documents AND photo uploads from tradies etc.
router.post('/upload', upload.single('file'), async (req, res) => {
  const { token, requestId } = req.body;
  const file = req.file;

  if (!file) return res.status(400).json({ error: 'No file received' });

  const isPhoto = file.mimetype.startsWith('image/');
  const fileId  = crypto.randomUUID();
  const ext     = file.originalname.split('.').pop();
  const storagePath = `client-documents/${fileId}.${ext}`;

  // PRODUCTION — upload to Supabase Storage:
  // const { data, error } = await supabase.storage
  //   .from('client-documents')
  //   .upload(storagePath, file.buffer, {
  //     contentType: file.mimetype,
  //     upsert: false,
  //   });
  // if (error) return res.status(500).json({ error: 'Upload failed' });

  // For photo uploads — we flag them for bookkeeper quality review
  // await supabase.from('document_uploads').insert({
  //   id:              fileId,
  //   client_id:       tokenRecord.client_id,
  //   request_id:      requestId,
  //   original_name:   file.originalname,
  //   storage_path:    storagePath,
  //   mime_type:       file.mimetype,
  //   size_bytes:      file.size,
  //   is_photo:        isPhoto,
  //   needs_review:    isPhoto, // ← flag photos for bookkeeper to check quality
  //   uploaded_at:     new Date().toISOString(),
  // });

  // Notify bookkeeper of upload
  // await notifyBookkeeper({
  //   type:    isPhoto ? 'photo_upload' : 'document_upload',
  //   message: `${isPhoto ? '📷 Photo' : '📄 Document'} uploaded by client: ${file.originalname}`,
  //   clientId: tokenRecord.client_id,
  // });

  console.log('[Portal] File uploaded:', file.originalname, isPhoto ? '(PHOTO — needs review)' : '(document)');

  res.json({
    success:     true,
    fileId,
    isPhoto,
    needsReview: isPhoto,
    message: isPhoto
      ? 'Photo received — your bookkeeper will review the image quality'
      : 'Document received successfully',
  });
});

// ── ROUTE: Approve BAS ─────────────────────────────────────────────────────
// POST /api/portal/approve-bas
router.post('/approve-bas', async (req, res) => {
  const { token, quarter } = req.body;

  // await supabase.from('bas_approvals').insert({
  //   client_id:   tokenRecord.client_id,
  //   quarter,
  //   approved_at: new Date().toISOString(),
  //   ip_address:  req.ip, // for audit trail
  // });

  // Notify bookkeeper
  // await notifyBookkeeper({ type: 'bas_approved', clientId: tokenRecord.client_id, quarter });

  // Add to audit log
  // await supabase.from('audit_log').insert({
  //   client_id: tokenRecord.client_id,
  //   action:    'bas_approved_by_client',
  //   detail:    `BAS ${quarter} approved via client portal`,
  // });

  console.log('[Portal] BAS approved for quarter:', quarter);
  res.json({ success: true });
});

// ── ROUTE: Send message ────────────────────────────────────────────────────
// POST /api/portal/message
router.post('/message', async (req, res) => {
  const { token, text } = req.body;

  // await supabase.from('portal_messages').insert({
  //   client_id:  tokenRecord.client_id,
  //   sender:     'client',
  //   text,
  //   sent_at:    new Date().toISOString(),
  // });

  // Notify bookkeeper via email/push
  // await notifyBookkeeper({ type: 'message', clientId: tokenRecord.client_id, text });

  console.log('[Portal] Message from client:', text);
  res.json({ success: true });
});

module.exports = router;
