const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const db = require('../db/connection');
const { authMiddleware, superUserOnly } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware, superUserOnly);

// ── Admin management ────────────────────────────────────────

// GET all admin accounts
router.get('/admins', async (req, res) => {
  const admins = await db('admin_settings').select('id', 'email', 'created_at');
  res.json(admins);
});

// POST create new admin
router.post('/admins', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) return res.status(400).json({ error: 'email and password required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  const hash = await bcrypt.hash(password, 10);
  const [admin] = await db('admin_settings').insert({ email: email.trim().toLowerCase(), password_hash: hash }).returning('*');
  res.status(201).json({ id: admin.id, email: admin.email });
});

// PUT update admin credentials
router.put('/admins/:id', async (req, res) => {
  const { email, password } = req.body;
  const updates = {};
  if (email) updates.email = email.trim().toLowerCase();
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    updates.password_hash = await bcrypt.hash(password, 10);
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });
  await db('admin_settings').where({ id: req.params.id }).update(updates);

  // Re-issue token if superuser is editing their own linked admin
  const updated = await db('admin_settings').where({ id: req.params.id }).first();
  const token = jwt.sign({ email: updated.email, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, email: updated.email, token });
});

// DELETE admin
router.delete('/admins/:id', async (req, res) => {
  const count = await db('admin_settings').count('id as n').first();
  if (Number(count.n) <= 1) return res.status(400).json({ error: 'Cannot delete the last admin account' });
  await db('admin_settings').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ── Superuser self-management ───────────────────────────────

router.get('/me', async (req, res) => {
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  res.json({ id: su.id, name: su.name, email: su.email });
});

router.put('/me', async (req, res) => {
  const { name, email, currentPassword, newPassword } = req.body;
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  if (!su) return res.status(404).json({ error: 'Not found' });

  const valid = await bcrypt.compare(currentPassword, su.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const updates = {};
  if (name) updates.name = name.trim();
  if (email) updates.email = email.trim().toLowerCase();
  if (newPassword) {
    if (newPassword.length < 6) return res.status(400).json({ error: 'Min 6 characters' });
    updates.password_hash = await bcrypt.hash(newPassword, 10);
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  await db('superusers').where({ id: su.id }).update(updates);
  const newEmail = updates.email || su.email;
  const token = jwt.sign({ superUserId: su.id, email: newEmail, isSuperUser: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, email: newEmail, token });
});

// ── All Students (cross-teacher) ────────────────────────────
router.get('/students', async (req, res) => {
  const students = await db('students')
    .leftJoin('cohorts', 'students.cohort_id', 'cohorts.id')
    .leftJoin('teachers', 'students.registered_by_teacher_id', 'teachers.id')
    .select(
      'students.id', 'students.email', 'students.name', 'students.created_at',
      'cohorts.code as cohortCode', 'cohorts.name as cohortName',
      'teachers.name as teacherName', 'teachers.email as teacherEmail'
    )
    .orderBy('students.created_at', 'desc');

  const counts = await db('exam_sessions')
    .whereNotNull('submitted_at')
    .groupBy('student_id')
    .select(
      'student_id',
      db.raw('count(*) as total'),
      db.raw("count(*) filter (where mode = 'exam') as exam_count"),
      db.raw("count(*) filter (where mode = 'practice') as practice_count"),
      db.raw("avg(score) filter (where mode = 'exam' and score is not null) as avg_exam_score")
    );

  const countMap = {};
  counts.forEach((c) => { countMap[c.student_id] = c; });

  res.json(students.map((s) => ({
    ...s,
    totalAttempts: Number(countMap[s.id]?.total || 0),
    examCount: Number(countMap[s.id]?.exam_count || 0),
    practiceCount: Number(countMap[s.id]?.practice_count || 0),
    avgExamScore: countMap[s.id]?.avg_exam_score ? Math.round(Number(countMap[s.id].avg_exam_score)) : null,
  })));
});

// DELETE a student (superuser only)
router.delete('/students/:id', async (req, res) => {
  await db('exam_sessions').where({ student_id: req.params.id }).delete();
  await db('students').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ── All teacher-owned questions (including drafts) ───────────
router.get('/teacher-questions', async (req, res) => {
  const { draft, teacherId } = req.query;
  let query = db('questions')
    .leftJoin('teachers', 'questions.teacher_id', 'teachers.id')
    .where('questions.owner_type', 'teacher')
    .select('questions.*', 'teachers.name as teacherName', 'teachers.email as teacherEmail');

  if (draft === 'true') query = query.where('questions.draft', true);
  else if (draft === 'false') query = query.where('questions.draft', false);
  if (teacherId) query = query.where('questions.teacher_id', teacherId);

  const questions = await query.orderBy('questions.created_at', 'desc').limit(200);
  res.json({ questions, total: questions.length });
});

// PATCH publish a teacher question
router.patch('/teacher-questions/:id/publish', async (req, res) => {
  const q = await db('questions').where({ id: req.params.id, owner_type: 'teacher' }).first();
  if (!q) return res.status(404).json({ error: 'Not found' });
  await db('questions').where({ id: req.params.id }).update({ draft: false, active: true, has_answer: !!q.correct_answer });
  res.json({ ok: true });
});

// DELETE a teacher question
router.delete('/teacher-questions/:id', async (req, res) => {
  await db('questions').where({ id: req.params.id, owner_type: 'teacher' }).delete();
  res.json({ ok: true });
});

// ── Stats overview ──────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [admins, teachers, students, exams, questions] = await Promise.all([
    db('admin_settings').count('id as n').first(),
    db('teachers').where({ active: true }).count('id as n').first(),
    db('students').count('id as n').first(),
    db('exam_sessions').whereNotNull('submitted_at').count('id as n').first(),
    db('questions').where({ active: true }).count('id as n').first(),
  ]);
  res.json({
    admins: Number(admins.n),
    teachers: Number(teachers.n),
    students: Number(students.n),
    exams: Number(exams.n),
    questions: Number(questions.n),
  });
});

// ── MFA ───────────────────────────────────────────────────────

// GET /api/superuser/mfa/status
router.get('/mfa/status', async (req, res) => {
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  res.json({ mfaEnabled: !!(su?.mfa_enabled) });
});

// POST /api/superuser/mfa/setup
router.post('/mfa/setup', async (req, res) => {
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  if (!su) return res.status(404).json({ error: 'Account not found' });
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(su.email, 'CertPath Superuser', secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
  await db('superusers').where({ id: su.id }).update({ mfa_secret: secret, mfa_enabled: false });
  res.json({ secret, qrDataUrl });
});

// POST /api/superuser/mfa/enable
router.post('/mfa/enable', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  if (!su || !su.mfa_secret) return res.status(400).json({ error: 'Start setup first' });
  if (su.mfa_enabled) return res.status(400).json({ error: 'MFA is already enabled' });
  const valid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: su.mfa_secret });
  if (!valid) return res.status(401).json({ error: 'Invalid code. Make sure your authenticator app is synced.' });
  await db('superusers').where({ id: su.id }).update({ mfa_enabled: true });
  res.json({ ok: true });
});

// POST /api/superuser/mfa/disable — requires password + TOTP code
router.post('/mfa/disable', async (req, res) => {
  const { password, code } = req.body;
  if (!password || !code) return res.status(400).json({ error: 'Password and code are required' });
  const su = await db('superusers').where({ id: req.user.superUserId }).first();
  if (!su) return res.status(404).json({ error: 'Account not found' });
  if (!su.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });
  const validPw = await bcrypt.compare(password, su.password_hash);
  if (!validPw) return res.status(401).json({ error: 'Incorrect password' });
  const validCode = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: su.mfa_secret });
  if (!validCode) return res.status(401).json({ error: 'Invalid authenticator code' });
  await db('superusers').where({ id: su.id }).update({ mfa_enabled: false, mfa_secret: null });
  res.json({ ok: true });
});

module.exports = router;
