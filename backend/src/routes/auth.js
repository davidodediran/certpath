const express = require('express');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const db = require('../db/connection');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const router = express.Router();

// Seed admin on first use if not in DB
async function getOrCreateAdmin() {
  let admin = await db('admin_settings').first();
  if (!admin) {
    const defaultEmail = process.env.ADMIN_EMAIL || 'admin@examapp.com';
    const defaultPassword = process.env.ADMIN_PASSWORD || 'sesan174';
    const hash = await bcrypt.hash(defaultPassword, 10);
    [admin] = await db('admin_settings').insert({ email: defaultEmail, password_hash: hash }).returning('*');
  }
  return admin;
}

// Seed superuser on first use if not in DB
async function getOrCreateSuperUser() {
  let su = await db('superusers').where({ active: true }).first();
  if (!su) {
    const defaultEmail = process.env.SUPER_EMAIL || 'super@examapp.com';
    const defaultPassword = process.env.SUPER_PASSWORD || 'super@rt2025';
    const hash = await bcrypt.hash(defaultPassword, 10);
    [su] = await db('superusers').insert({
      name: 'Super Admin',
      email: defaultEmail,
      password_hash: hash,
      active: true,
    }).returning('*');
  }
  return su;
}

// POST /api/auth/login
router.post('/login', async (req, res) => {
  try {
  const { email, cohortCode, password } = req.body;
  if (!email) return res.status(400).json({ error: 'Email is required' });

  const emailLower = email.trim().toLowerCase();

  if (password !== undefined) {
    // ── Superuser check first — auto-seed if table empty ──
    await getOrCreateSuperUser();
    const su = await db('superusers').where({ email: emailLower, active: true }).first();
    if (su) {
      const valid = await bcrypt.compare(password, su.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid credentials' });
      // MFA check for superuser
      if (su.mfa_enabled && su.mfa_secret) {
        const mfaToken = jwt.sign(
          { mfaPending: true, role: 'superuser', superUserId: su.id, email: emailLower },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        return res.json({ mfaRequired: true, mfaToken });
      }
      const token = jwt.sign(
        { superUserId: su.id, email: emailLower, isSuperUser: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({ token, isSuperUser: true, email: emailLower, name: su.name });
    }

    // ── Admin check ────────────────────────────────────────
    const admin = await getOrCreateAdmin();
    if (emailLower === admin.email.toLowerCase()) {
      const valid = await bcrypt.compare(password, admin.password_hash);
      if (!valid) return res.status(401).json({ error: 'Invalid admin credentials' });
      // MFA check for admin
      if (admin.mfa_enabled && admin.mfa_secret) {
        const mfaToken = jwt.sign(
          { mfaPending: true, role: 'admin', adminId: admin.id, email: emailLower },
          process.env.JWT_SECRET,
          { expiresIn: '5m' }
        );
        return res.json({ mfaRequired: true, mfaToken });
      }
      const token = jwt.sign(
        { email: emailLower, isAdmin: true },
        process.env.JWT_SECRET,
        { expiresIn: '7d' }
      );
      return res.json({ token, isAdmin: true, email: emailLower });
    }

    // ── Teacher check ──────────────────────────────────────
    const teacher = await db('teachers').where({ email: emailLower, active: true }).first();
    if (!teacher) return res.status(401).json({ error: 'Invalid credentials' });
    if (!teacher.password_hash) return res.status(401).json({ error: 'Teacher account is not properly set up. Contact admin.' });
    const validTeacher = await bcrypt.compare(password, teacher.password_hash);
    if (!validTeacher) return res.status(401).json({ error: 'Invalid credentials' });

    // If MFA is enabled, issue a short-lived MFA-pending token instead of a full session
    if (teacher.mfa_enabled && teacher.mfa_secret) {
      const mfaToken = jwt.sign(
        { mfaPending: true, teacherId: teacher.id, email: emailLower },
        process.env.JWT_SECRET,
        { expiresIn: '5m' }
      );
      return res.json({ mfaRequired: true, mfaToken });
    }

    const token = jwt.sign(
      { teacherId: teacher.id, email: emailLower, isTeacher: true },
      process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
    return res.json({ token, isTeacher: true, email: emailLower, name: teacher.name });
  }

  // ── Student path ──────────────────────────────────────────
  if (!cohortCode) return res.status(400).json({ error: 'Cohort code is required' });

  const cohortCode_upper = cohortCode.trim().toUpperCase();
  const cohortCandidates = await db('cohorts').where({ code: cohortCode_upper, active: true });
  if (cohortCandidates.length === 0) return res.status(401).json({ error: 'Invalid cohort code. Please check with your instructor.' });

  // Check student is pre-registered (teacher uploaded them) OR allow open registration
  let student = await db('students').where({ email: emailLower }).first();

  // When multiple active cohorts share the same code, resolve using the student's
  // stored cohort_id. New students cannot self-register into an ambiguous code.
  let cohort;
  if (cohortCandidates.length > 1) {
    if (!student) return res.status(401).json({ error: 'Cohort code is ambiguous. Please contact your instructor.' });
    cohort = cohortCandidates.find((c) => c.id === student.cohort_id);
    if (!cohort) return res.status(401).json({ error: 'Invalid cohort code for your account.' });
  } else {
    cohort = cohortCandidates[0];
  }

  if (!student) {
    // Check if cohort requires pre-registration
    const preRegCount = await db('students').where({ cohort_id: cohort.id }).count('id as n').first();
    if (Number(preRegCount.n) > 0) {
      return res.status(401).json({ error: 'Your email is not registered in this cohort. Contact your teacher.' });
    }
    // Open cohort — auto-register
    [student] = await db('students')
      .insert({ email: emailLower, cohort_id: cohort.id })
      .returning('*');
  } else if (student.cohort_id !== cohort.id) {
    return res.status(401).json({ error: 'This email is not registered in the given cohort.' });
  }

  // MFA check for student
  if (student.mfa_enabled && student.mfa_secret) {
    const mfaToken = jwt.sign(
      { mfaPending: true, role: 'student', studentId: student.id, cohortId: cohort.id, cohortName: cohort.name, email: emailLower },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.json({ mfaRequired: true, mfaToken });
  }

  const token = jwt.sign(
    { studentId: student.id, email: emailLower, cohortId: cohort.id, isAdmin: false },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );
  return res.json({ token, isAdmin: false, email: emailLower, cohort: cohort.name, name: student.name || null });
  } catch (err) {
    console.error('[auth/login]', err);
    return res.status(500).json({ error: 'Login service error. Please try again.' });
  }
});

// POST /api/auth/mfa/verify — verify TOTP code after password success
// Handles teacher, admin, and superuser roles via the 'role' field in mfaToken
// Body: { mfaToken, code }
router.post('/mfa/verify', async (req, res) => {
  try {
  const { mfaToken, code } = req.body;
  if (!mfaToken || !code) return res.status(400).json({ error: 'Token and code are required' });

  let payload;
  try {
    payload = jwt.verify(mfaToken, process.env.JWT_SECRET);
  } catch {
    return res.status(401).json({ error: 'MFA session expired. Please log in again.' });
  }
  if (!payload.mfaPending) return res.status(401).json({ error: 'Invalid MFA token' });

  const cleanCode = String(code).replace(/\s/g, '');

  // ── Superuser ──────────────────────────────────────────
  if (payload.role === 'superuser') {
    const su = await db('superusers').where({ id: payload.superUserId, active: true }).first();
    if (!su || !su.mfa_secret) return res.status(401).json({ error: 'Account not found' });
    if (!authenticator.verify({ token: cleanCode, secret: su.mfa_secret }))
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    const token = jwt.sign(
      { superUserId: su.id, email: su.email, isSuperUser: true },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    return res.json({ token, isSuperUser: true, email: su.email, name: su.name });
  }

  // ── Admin ──────────────────────────────────────────────
  if (payload.role === 'admin') {
    const admin = await db('admin_settings').where({ id: payload.adminId }).first();
    if (!admin || !admin.mfa_secret) return res.status(401).json({ error: 'Account not found' });
    if (!authenticator.verify({ token: cleanCode, secret: admin.mfa_secret }))
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    const token = jwt.sign(
      { email: admin.email, isAdmin: true },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    return res.json({ token, isAdmin: true, email: admin.email });
  }

  // ── Student ────────────────────────────────────────────
  if (payload.role === 'student') {
    const student = await db('students').where({ id: payload.studentId }).first();
    if (!student || !student.mfa_secret) return res.status(401).json({ error: 'Account not found' });
    if (!authenticator.verify({ token: cleanCode, secret: student.mfa_secret }))
      return res.status(401).json({ error: 'Invalid code. Please try again.' });
    const token = jwt.sign(
      { studentId: student.id, email: student.email, cohortId: payload.cohortId, isAdmin: false },
      process.env.JWT_SECRET, { expiresIn: '7d' }
    );
    // Fetch cohort name for response
    const cohort = await db('cohorts').where({ id: payload.cohortId }).first();
    return res.json({ token, isAdmin: false, email: student.email, name: student.name || null, cohort: cohort?.name || '' });
  }

  // ── Teacher (legacy role field may be absent) ──────────
  if (!payload.teacherId) return res.status(401).json({ error: 'Invalid MFA token' });
  const teacher = await db('teachers').where({ id: payload.teacherId, active: true }).first();
  if (!teacher || !teacher.mfa_secret) return res.status(401).json({ error: 'Teacher not found' });
  if (!authenticator.verify({ token: cleanCode, secret: teacher.mfa_secret }))
    return res.status(401).json({ error: 'Invalid code. Please try again.' });
  const token = jwt.sign(
    { teacherId: teacher.id, email: teacher.email, isTeacher: true },
    process.env.JWT_SECRET, { expiresIn: '7d' }
  );
  return res.json({ token, isTeacher: true, email: teacher.email, name: teacher.name });
  } catch (err) {
    console.error('[auth/mfa/verify]', err);
    return res.status(500).json({ error: 'MFA verification error. Please try again.' });
  }
});

// GET /api/auth/me
router.get('/me', authMiddleware, async (req, res) => {
  if (req.user.isSuperUser) {
    const su = await db('superusers').where({ id: req.user.superUserId }).first();
    return res.json({ email: su?.email || req.user.email, isSuperUser: true, name: su?.name });
  }
  if (req.user.isAdmin) {
    const admin = await db('admin_settings').first();
    return res.json({ email: admin?.email || req.user.email, isAdmin: true });
  }
  if (req.user.isTeacher) {
    const teacher = await db('teachers').where({ id: req.user.teacherId }).first();
    return res.json({ email: teacher?.email, isTeacher: true, name: teacher?.name });
  }
  const student = await db('students')
    .join('cohorts', 'students.cohort_id', 'cohorts.id')
    .where('students.id', req.user.studentId)
    .select('students.*', 'cohorts.name as cohortName', 'cohorts.code as cohortCode')
    .first();
  return res.json({ ...student, isAdmin: false });
});

// PUT /api/auth/admin/settings — change admin email + password
router.put('/admin/settings', authMiddleware, adminOnly, async (req, res) => {
  const { email, currentPassword, newPassword } = req.body;
  const admin = await db('admin_settings').first();
  if (!admin) return res.status(404).json({ error: 'Admin not found' });

  const valid = await bcrypt.compare(currentPassword, admin.password_hash);
  if (!valid) return res.status(401).json({ error: 'Current password is incorrect' });

  const updates = {};
  if (email && email.trim()) updates.email = email.trim().toLowerCase();
  if (newPassword && newPassword.length >= 6) {
    updates.password_hash = await bcrypt.hash(newPassword, 10);
  } else if (newPassword) {
    return res.status(400).json({ error: 'New password must be at least 6 characters' });
  }
  if (Object.keys(updates).length === 0) return res.status(400).json({ error: 'Nothing to update' });

  await db('admin_settings').where({ id: admin.id }).update(updates);
  const newEmail = updates.email || admin.email;
  const token = jwt.sign({ email: newEmail, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
  res.json({ ok: true, email: newEmail, token });
});

module.exports = router;
