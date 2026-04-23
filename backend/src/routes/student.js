const express = require('express');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const db = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// Guard: only authenticated student JWTs
function studentOnly(req, res, next) {
  if (!req.user || !req.user.studentId) {
    return res.status(403).json({ error: 'Student access required' });
  }
  next();
}

router.use(authMiddleware, studentOnly);

// GET /api/student/mfa/status
router.get('/mfa/status', async (req, res) => {
  const student = await db('students').where({ id: req.user.studentId }).first();
  res.json({ mfaEnabled: !!(student?.mfa_enabled) });
});

// POST /api/student/mfa/setup — generate secret + QR, store (not yet enabled)
router.post('/mfa/setup', async (req, res) => {
  const student = await db('students').where({ id: req.user.studentId }).first();
  if (!student) return res.status(404).json({ error: 'Account not found' });
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(student.email, 'CertPath', secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
  await db('students').where({ id: student.id }).update({ mfa_secret: secret, mfa_enabled: false });
  res.json({ secret, qrDataUrl });
});

// POST /api/student/mfa/enable — verify first code then activate
router.post('/mfa/enable', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  const student = await db('students').where({ id: req.user.studentId }).first();
  if (!student || !student.mfa_secret) return res.status(400).json({ error: 'Start setup first' });
  if (student.mfa_enabled) return res.status(400).json({ error: 'MFA is already enabled' });
  const valid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: student.mfa_secret });
  if (!valid) return res.status(401).json({ error: 'Invalid code. Make sure your authenticator app is synced.' });
  await db('students').where({ id: student.id }).update({ mfa_enabled: true });
  res.json({ ok: true });
});

// POST /api/student/mfa/disable — only requires current TOTP code (students have no password)
router.post('/mfa/disable', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Authenticator code is required' });
  const student = await db('students').where({ id: req.user.studentId }).first();
  if (!student) return res.status(404).json({ error: 'Account not found' });
  if (!student.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });
  const valid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: student.mfa_secret });
  if (!valid) return res.status(401).json({ error: 'Invalid authenticator code' });
  await db('students').where({ id: student.id }).update({ mfa_enabled: false, mfa_secret: null });
  res.json({ ok: true });
});

module.exports = router;
