const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../db/connection');
const { authMiddleware, teacherOnly } = require('../middleware/auth');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
// otplib v13 exports differ across environments — access authenticator safely
const _otplib = require('otplib');
const authenticator = _otplib.authenticator || (_otplib.default && _otplib.default.authenticator) || _otplib;
const QRCode = require('qrcode');
const { normalizeDomainsBulk } = require('../utils/domainNormalizer');
const conversionJobs = new Map();

const router = express.Router();
router.use(authMiddleware, teacherOnly);

// Auto-catch async errors for ALL routes in this router (Express 4 fix)
['get', 'post', 'put', 'patch', 'delete'].forEach((verb) => {
  const original = router[verb].bind(router);
  router[verb] = (path, ...handlers) => original(path, ...handlers.map((h) =>
    typeof h === 'function'
      ? (req, res, next) => Promise.resolve(h(req, res, next)).catch((err) => {
          console.error(`[Teacher ${verb.toUpperCase()} ${path}]`, err.message);
          if (err.code === '23505') return res.status(409).json({ error: 'A record with that code already exists.' });
          res.status(500).json({ error: err.message || 'Internal server error' });
        })
      : h
  ));
});

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── Helpers ─────────────────────────────────────────────────

// Resolve teacherId from JWT or DB (guards against stale JWTs)
async function resolveTeacherId(user) {
  if (user.teacherId) return user.teacherId;
  if (user.email) {
    const teacher = await db('teachers').where({ email: user.email.toLowerCase(), active: true }).first();
    if (teacher) return teacher.id;
  }
  return null;
}

async function accessibleCohortIds(user) {
  if (user.isAdmin || user.isSuperUser) {
    const rows = await db('cohorts').where({ active: true }).select('id');
    return rows.map((r) => r.id);
  }
  // Teachers can access: admin-created cohorts + their own created cohorts
  const teacherId = user.teacherId;
  const rows = await db('cohorts')
    .where({ active: true })
    .where(function () {
      this.whereNull('created_by_teacher_id')           // admin-created
          .orWhere({ created_by_teacher_id: teacherId }); // teacher's own
    })
    .select('id');
  return rows.map((r) => r.id);
}

// ── COHORTS ──────────────────────────────────────────────────

router.get('/cohorts', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  if (!teacherId) return res.status(403).json({ error: 'Teacher account required' });

  // Show admin-created cohorts + teacher's own cohorts
  const cohorts = await db('cohorts')
    .leftJoin('exam_types', 'cohorts.exam_type_id', 'exam_types.id')
    .where('cohorts.active', true)
    .where(function () {
      this.whereNull('cohorts.created_by_teacher_id')           // admin-created
          .orWhere('cohorts.created_by_teacher_id', teacherId); // teacher's own
    })
    .select(
      'cohorts.id', 'cohorts.code', 'cohorts.name', 'cohorts.question_bank',
      'cohorts.created_by_teacher_id', 'exam_types.name as examTypeName'
    )
    .orderBy('cohorts.created_at', 'desc');

  if (!cohorts.length) return res.json([]);

  const counts = await db('students')
    .whereIn('cohort_id', cohorts.map((c) => c.id))
    .groupBy('cohort_id')
    .select('cohort_id', db.raw('count(*) as n'));
  const countMap = Object.fromEntries(counts.map((c) => [c.cohort_id, Number(c.n)]));

  res.json(cohorts.map((c) => ({
    ...c,
    studentCount: countMap[c.id] || 0,
    isOwned: c.created_by_teacher_id === teacherId,   // true = teacher created it
    isAdminCohort: c.created_by_teacher_id === null,  // true = admin created it
  })));
});

// POST /api/teacher/cohorts — teacher creates their own cohort
router.post('/cohorts', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  if (!teacherId) return res.status(403).json({ error: 'Teacher account required' });

  const { name, code, examTypeId } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'name and code are required' });

  const cleanCode = code.trim().toUpperCase().replace(/\s+/g, '-');

  // Check code uniqueness only within this teacher's own cohorts (not globally)
  const existing = await db('cohorts').where({ code: cleanCode, created_by_teacher_id: teacherId }).first();
  if (existing) return res.status(400).json({ error: `You already have a cohort with code "${cleanCode}". Choose a different code.` });

  const [row] = await db('cohorts').insert({
    name: name.trim(),
    code: cleanCode,
    exam_type_id: examTypeId || null,
    active: true,
    created_by_teacher_id: teacherId,
  }).returning('id');

  const cohortId = (row && typeof row === 'object') ? row.id : row;

  // Link teacher to this cohort so it appears in their accessible cohorts
  await db('teacher_cohorts').insert({ teacher_id: teacherId, cohort_id: cohortId });

  res.status(201).json({ id: cohortId, name: name.trim(), code: cleanCode, created_by_teacher_id: teacherId });
});

// DELETE /api/teacher/cohorts/:id — teacher deletes a cohort they created
router.delete('/cohorts/:id', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  if (!teacherId) return res.status(403).json({ error: 'Teacher account required' });

  const cohort = await db('cohorts').where({ id: req.params.id, created_by_teacher_id: teacherId }).first();
  if (!cohort) return res.status(404).json({ error: 'Cohort not found or you did not create it' });

  const studentCount = await db('students').where({ cohort_id: req.params.id }).count('id as n').first();
  if (Number(studentCount.n) > 0) {
    return res.status(409).json({ error: `Cannot delete: ${studentCount.n} student(s) are still in this cohort. Remove them first.` });
  }

  await db('teacher_cohorts').where({ cohort_id: req.params.id }).delete();
  await db('cohorts').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

router.patch('/cohorts/:id/question-bank', async (req, res) => {
  const { questionBank } = req.body;
  if (!['admin', 'teacher', 'mixed'].includes(questionBank)) {
    return res.status(400).json({ error: 'questionBank must be admin, teacher, or mixed' });
  }
  const cohortIds = await accessibleCohortIds(req.user);
  if (!cohortIds.includes(Number(req.params.id))) return res.status(403).json({ error: 'Access denied' });

  await db('cohorts').where({ id: req.params.id }).update({ question_bank: questionBank });
  res.json({ ok: true });
});

// ── STUDENTS ─────────────────────────────────────────────────
// Isolation rules:
//   Teacher  → only sees students they registered (registered_by_teacher_id = teacherId)
//   Admin    → only sees students where registered_by_teacher_id IS NULL
//   Superuser → sees ALL students (handled in superuser route)

router.get('/students', async (req, res) => {
  let query = db('students')
    .join('cohorts', 'students.cohort_id', 'cohorts.id')
    .select('students.id', 'students.email', 'students.name', 'students.created_at',
      'students.registered_by_teacher_id',
      'cohorts.name as cohortName', 'cohorts.code as cohortCode', 'students.cohort_id');

  if (req.user.teacherId) {
    // Teacher: only own students
    query = query.where('students.registered_by_teacher_id', req.user.teacherId);
  } else {
    // Admin: only open-registration students
    query = query.whereNull('students.registered_by_teacher_id');
  }

  const students = await query.orderBy('students.email');
  const studentIds = students.map((s) => s.id);
  if (!studentIds.length) return res.json([]);

  const sessions = await db('exam_sessions')
    .whereIn('student_id', studentIds)
    .where('mode', 'exam')
    .whereNotNull('submitted_at')
    .where('cancelled', false)
    .select('student_id', 'score', 'passed');

  const statsMap = {};
  for (const s of sessions) {
    if (!statsMap[s.student_id]) statsMap[s.student_id] = { scores: [], passed: 0, passScores: [] };
    statsMap[s.student_id].scores.push(s.score);
    if (s.passed) {
      statsMap[s.student_id].passed++;
      statsMap[s.student_id].passScores.push(s.score);
    }
  }

  // Fetch active lockouts (device + attempt) for all students in one query each
  const now = new Date();

  const deviceLockouts = await db('device_lockouts')
    .whereIn('student_id', studentIds)
    .where('locked_until', '>', now)
    .orderBy('locked_until', 'desc')
    .select('student_id', 'locked_until', 'reason');

  const attemptLockouts = await db('exam_attempt_lockouts')
    .whereIn('student_id', studentIds)
    .where('locked_until', '>', now)
    .orderBy('locked_until', 'desc')
    .select('student_id', 'locked_until', 'reason', 'attempt_count');

  // Build a map: studentId → most severe active lockout
  const lockoutMap = {};
  for (const l of deviceLockouts) {
    lockoutMap[l.student_id] = {
      type: 'device',
      label: 'Anti-cheat Suspended',
      until: l.locked_until,
      reason: l.reason || 'Three anti-cheat violations during exam',
    };
  }
  for (const l of attemptLockouts) {
    const existing = lockoutMap[l.student_id];
    // Device lockout takes priority; otherwise set attempt lockout
    if (!existing) {
      lockoutMap[l.student_id] = {
        type: 'attempt',
        label: 'Too Many Attempts',
        until: l.locked_until,
        reason: `${l.attempt_count || 3} incomplete attempts in one day`,
      };
    }
  }

  res.json(students.map((s) => {
    const stats = statsMap[s.id] || { scores: [], passed: 0, passScores: [] };
    const avg = stats.scores.length
      ? Math.round(stats.scores.reduce((a, b) => a + b, 0) / stats.scores.length)
      : null;
    const passScores = stats.passScores || [];
    const avgPassScore = passScores.length
      ? Math.round(passScores.reduce((a, b) => a + b, 0) / passScores.length)
      : null;
    const passCount750 = (stats.passScores || []).filter((sc) => sc >= 750).length;
    const passCount800 = (stats.passScores || []).filter((sc) => sc >= 800).length;
    const isQualified = passCount750 > 10 || passCount800 > 8;
    return {
      ...s,
      examAttempts: stats.scores.length,
      avgScore: avg,
      passCount: stats.passed,
      avgPassScore,
      isQualified,
      activeLockout: lockoutMap[s.id] || null,
    };
  }));
});

// DELETE /api/teacher/students/:id/lockout — unlock a student's Exam Mode suspension
router.delete('/students/:id/lockout', async (req, res) => {
  const now = new Date();
  // Remove all active device lockouts for this student
  const deviceRemoved = await db('device_lockouts')
    .where('student_id', req.params.id)
    .where('locked_until', '>', now)
    .delete();
  // Remove all active attempt lockouts
  const attemptRemoved = await db('exam_attempt_lockouts')
    .where('student_id', req.params.id)
    .where('locked_until', '>', now)
    .delete();
  res.json({ removed: deviceRemoved + attemptRemoved, ok: true });
});

// POST /api/teacher/students — create a single student
router.post('/students', async (req, res) => {
  try {
    const { name, email, cohortId } = req.body;
    if (!email || !cohortId) return res.status(400).json({ error: 'email and cohortId are required' });

    const cohortIds = await accessibleCohortIds(req.user);
    if (!cohortIds.includes(Number(cohortId))) return res.status(403).json({ error: 'Access denied to this cohort' });

    const normalizedEmail = email.trim().toLowerCase();
    const existing = await db('students').where({ email: normalizedEmail }).first();
    if (existing) return res.status(409).json({ error: 'A student with this email already exists' });

    const teacherId = await resolveTeacherId(req.user);
    const [student] = await db('students').insert({
      email: normalizedEmail,
      name: name ? name.trim() : null,
      cohort_id: cohortId,
      registered_by_teacher_id: teacherId,
    }).returning('*');

    res.status(201).json(student);
  } catch (err) {
    console.error('POST /students error:', err);
    res.status(500).json({ error: err.message || 'Failed to create student' });
  }
});

// PUT /api/teacher/students/:id — edit student details (own students only)
router.put('/students/:id', async (req, res) => {
  const student = await db('students').where({ id: req.params.id }).first();
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Only the teacher who registered this student can edit
  if (req.user.teacherId && String(student.registered_by_teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { name, email } = req.body;
  const updates = {};
  if (name !== undefined) updates.name = name.trim();
  if (email) {
    const existing = await db('students').where({ email: email.trim().toLowerCase() })
      .whereNot({ id: req.params.id }).first();
    if (existing) return res.status(409).json({ error: 'Email already in use' });
    updates.email = email.trim().toLowerCase();
  }
  if (!Object.keys(updates).length) return res.status(400).json({ error: 'Nothing to update' });

  await db('students').where({ id: req.params.id }).update(updates);
  res.json({ ok: true });
});

// DELETE /api/teacher/students/bulk — remove multiple own students
router.delete('/students/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const teacherId = req.user.teacherId || null;
  let query = db('students').whereIn('id', ids);
  if (teacherId) query = query.where('registered_by_teacher_id', teacherId);
  const deleted = await query.delete();
  res.json({ deleted });
});

// DELETE /api/teacher/students/:id — remove own student
router.delete('/students/:id', async (req, res) => {
  const student = await db('students').where({ id: req.params.id }).first();
  if (!student) return res.status(404).json({ error: 'Student not found' });
  if (req.user.teacherId && String(student.registered_by_teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await db('students').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// POST /api/teacher/students/upload — CSV with name,email columns
router.post('/students/upload', upload.single('file'), async (req, res) => {
  const { cohortId } = req.body;
  if (!cohortId) return res.status(400).json({ error: 'cohortId is required' });

  const cohortIds = await accessibleCohortIds(req.user);
  if (!cohortIds.includes(Number(cohortId))) return res.status(403).json({ error: 'Access denied' });

  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = fs.readFileSync(req.file.path, 'utf8');
  fs.unlinkSync(req.file.path);

  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);

  // Detect if header row exists by checking if first row contains 'email'
  let dataLines = lines;
  const firstRow = lines[0].toLowerCase();
  if (firstRow.includes('email') || firstRow.includes('name')) {
    dataLines = lines.slice(1);
  }

  const records = [];
  for (const line of dataLines) {
    const parts = line.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
    let name = '', email = '';

    if (parts.length >= 2) {
      // Could be: name,email OR email,name — detect by @ sign
      if (parts[0].includes('@')) {
        email = parts[0].toLowerCase();
        name = parts[1];
      } else {
        name = parts[0];
        email = parts[1].toLowerCase();
      }
    } else if (parts.length === 1 && parts[0].includes('@')) {
      email = parts[0].toLowerCase();
    }

    if (email && email.includes('@')) records.push({ name, email });
  }

  if (!records.length) return res.status(400).json({ error: 'No valid records found in CSV' });

  let added = 0, skipped = 0;
  for (const { name, email } of records) {
    const existing = await db('students').where({ email }).first();
    if (existing) { skipped++; continue; }
    await db('students').insert({
      email,
      name: name || null,
      cohort_id: cohortId,
      registered_by_teacher_id: req.user.teacherId || null,
    });
    added++;
  }

  res.json({ added, skipped, total: records.length });
});

// POST /api/teacher/students/upload-with-cohort — CSV with cohort_code,name,email (creates students across cohorts by code)
router.post('/students/upload-with-cohort', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const content = fs.readFileSync(req.file.path, 'utf8');
  fs.unlinkSync(req.file.path);

  const cohortIds = await accessibleCohortIds(req.user);
  if (!cohortIds.length) return res.status(403).json({ error: 'No cohorts assigned to you' });

  // Build cohort lookup by code
  const cohortRows = await db('cohorts').whereIn('id', cohortIds).select('id', 'code', 'name');
  const cohortByCode = Object.fromEntries(cohortRows.map((c) => [c.code.toLowerCase(), c]));

  const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
  if (!lines.length) return res.status(400).json({ error: 'Empty file' });

  // Parse header
  const header = lines[0].split(',').map((h) => h.replace(/^["']|["']$/g, '').trim().toLowerCase());
  const cohortIdx = header.findIndex((h) => h.includes('cohort'));
  const nameIdx = header.findIndex((h) => h.includes('name') && !h.includes('cohort'));
  const emailIdx = header.findIndex((h) => h.includes('email'));

  if (emailIdx === -1) return res.status(400).json({ error: 'CSV must have an "email" column' });

  const dataLines = lines.slice(1);
  let added = 0, skipped = 0, errors = [];

  for (const line of dataLines) {
    const parts = line.split(',').map((v) => v.replace(/^["']|["']$/g, '').trim());
    const email = (parts[emailIdx] || '').toLowerCase();
    const name = nameIdx >= 0 ? (parts[nameIdx] || '') : '';
    const cohortCode = cohortIdx >= 0 ? (parts[cohortIdx] || '').toLowerCase() : null;

    if (!email || !email.includes('@')) continue;

    let cohortId = null;
    if (cohortCode) {
      const cohort = cohortByCode[cohortCode];
      if (!cohort) { errors.push(`Unknown cohort code: ${parts[cohortIdx]}`); continue; }
      cohortId = cohort.id;
    } else if (cohortIds.length === 1) {
      cohortId = cohortIds[0]; // default to single cohort
    } else {
      errors.push(`Row missing cohort_code for ${email}`); continue;
    }

    const existing = await db('students').where({ email }).first();
    if (existing) { skipped++; continue; }

    await db('students').insert({
      email,
      name: name || null,
      cohort_id: cohortId,
      registered_by_teacher_id: req.user.teacherId || null,
    });
    added++;
  }

  res.json({ added, skipped, errors: errors.slice(0, 10), total: dataLines.length });
});

// GET /api/teacher/students/sample.csv
router.get('/students/sample.csv', (req, res) => {
  const csv = 'name,email\nJohn Doe,john.doe@example.com\nJane Smith,jane.smith@example.com\nKwame Mensah,k.mensah@company.org\n';
  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="sample_students.csv"');
  res.send(csv);
});

// GET /api/teacher/students/:studentId/performance
router.get('/students/:studentId/performance', async (req, res) => {
  const { studentId } = req.params;
  const student = await db('students').where({ id: studentId }).first();
  if (!student) return res.status(404).json({ error: 'Student not found' });

  // Isolation check
  if (req.user.teacherId && String(student.registered_by_teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const allSessions = await db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .where('exam_sessions.student_id', studentId)
    .whereNotNull('exam_sessions.submitted_at')
    .where('exam_sessions.cancelled', false)
    .select('exam_sessions.id', 'exam_sessions.mode', 'exam_sessions.score', 'exam_sessions.passed',
      'exam_sessions.submitted_at', 'exam_sessions.domain_results',
      'exam_types.name as examName', 'exam_types.passing_score as passingScore')
    .orderBy('exam_sessions.submitted_at', 'asc');

  const examSessions = allSessions.filter((s) => s.mode === 'exam');
  const scores = examSessions.map((s) => s.score);

  // Qualification tracking
  const passScoresArr  = examSessions.filter((s) => s.passed).map((s) => s.score);
  const avgPassScore   = passScoresArr.length
    ? Math.round(passScoresArr.reduce((a, b) => a + b, 0) / passScoresArr.length)
    : null;
  const examPassCount  = examSessions.filter((s) => s.passed).length;
  const passCount750   = passScoresArr.filter((sc) => sc >= 750).length;
  const passCount800   = passScoresArr.filter((sc) => sc >= 800).length;
  const isQualified    = passCount750 > 10 || passCount800 > 8;

  let readiness = null, trend = null, avgScore = null;
  if (scores.length > 0) {
    avgScore = Math.round(scores.reduce((a, b) => a + b, 0) / scores.length);
    const passingScore = examSessions[0]?.passingScore || 700;
    if (avgScore >= 750) readiness = { label: 'Exam Ready', level: 'ready', color: 'green' };
    else if (avgScore >= passingScore) readiness = { label: 'Almost Ready', level: 'close', color: 'lime' };
    else if (avgScore >= 600) readiness = { label: 'On Track', level: 'progressing', color: 'yellow' };
    else readiness = { label: 'Needs More Practice', level: 'early', color: 'red' };

    if (scores.length >= 4) {
      const mid = Math.floor(scores.length / 2);
      const early = scores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const recent = scores.slice(-mid).reduce((a, b) => a + b, 0) / mid;
      const delta = recent - early;
      trend = delta > 30 ? 'improving' : delta < -30 ? 'declining' : 'stable';
    }
  }

  const domainTotals = {};
  for (const s of examSessions) {
    const dr = s.domain_results || {};
    for (const [domain, stats] of Object.entries(dr)) {
      if (!domainTotals[domain]) domainTotals[domain] = { meets: 0, total: 0 };
      domainTotals[domain].total++;
      if (stats.performance === 'Meets Competency') domainTotals[domain].meets++;
    }
  }
  const domainSummary = Object.entries(domainTotals).map(([domain, d]) => ({
    domain, meetsPct: d.total ? Math.round((d.meets / d.total) * 100) : 0,
  }));

  // Active lockouts for this student (device + attempt)
  const now = new Date();
  const deviceLockout = await db('device_lockouts')
    .where('student_id', studentId)
    .where('locked_until', '>', now)
    .orderBy('locked_until', 'desc')
    .first();
  const attemptLockout = await db('exam_attempt_lockouts')
    .where('student_id', studentId)
    .where('locked_until', '>', now)
    .orderBy('locked_until', 'desc')
    .first();
  let activeLockout = null;
  if (deviceLockout) {
    activeLockout = {
      type: 'device',
      label: 'Anti-cheat Suspended',
      until: deviceLockout.locked_until,
      reason: deviceLockout.reason || 'Three anti-cheat violations during exam',
    };
  } else if (attemptLockout) {
    activeLockout = {
      type: 'attempt',
      label: 'Too Many Attempts',
      until: attemptLockout.locked_until,
      reason: `${attemptLockout.attempt_count || 3} incomplete attempts in one day`,
    };
  }

  res.json({
    student: { id: student.id, name: student.name, email: student.email },
    sessions: allSessions, examSessions, avgScore, readiness, trend, domainSummary,
    totalExamAttempts: examSessions.length,
    passCount: examPassCount,
    avgPassScore,
    isQualified,
    activeLockout,
  });
});

// GET /api/teacher/students/:id/activity — exam session activity logs for a student
router.get('/students/:id/activity', async (req, res) => {
  const sessions = await db('exam_sessions')
    .leftJoin('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .where('exam_sessions.student_id', req.params.id)
    .orderBy('exam_sessions.started_at', 'desc')
    .limit(20)
    .select(
      'exam_sessions.id', 'exam_sessions.mode', 'exam_sessions.started_at',
      'exam_sessions.submitted_at', 'exam_sessions.score', 'exam_sessions.cancelled',
      'exam_sessions.anti_cheat_strikes',
      'exam_types.name as examTypeName'
    );

  const sessionIds = sessions.map((s) => s.id);
  const activityLogs = sessionIds.length > 0
    ? await db('exam_activity_logs')
        .whereIn('session_id', sessionIds)
        .orderBy('occurred_at', 'asc')
    : [];

  const logsMap = {};
  activityLogs.forEach((log) => {
    if (!logsMap[log.session_id]) logsMap[log.session_id] = [];
    logsMap[log.session_id].push(log);
  });

  res.json(sessions.map((s) => ({ ...s, activities: logsMap[s.id] || [] })));
});

// DELETE /api/teacher/students/:studentId/sessions/:sessionId — delete one exam session
router.delete('/students/:studentId/sessions/:sessionId', async (req, res) => {
  const cohortIds = await accessibleCohortIds(req.user);
  const student = await db('students')
    .where({ id: req.params.studentId })
    .whereIn('cohort_id', cohortIds)
    .first();
  if (!student) return res.status(404).json({ error: 'Student not found or not in your cohorts' });

  const deleted = await db('exam_sessions')
    .where({ id: req.params.sessionId, student_id: req.params.studentId })
    .delete();
  if (!deleted) return res.status(404).json({ error: 'Session not found' });
  res.json({ ok: true });
});

// DELETE /api/teacher/students/:studentId/sessions — delete ALL sessions for a student (full reset)
router.delete('/students/:studentId/sessions', async (req, res) => {
  const cohortIds = await accessibleCohortIds(req.user);
  const student = await db('students')
    .where({ id: req.params.studentId })
    .whereIn('cohort_id', cohortIds)
    .first();
  if (!student) return res.status(404).json({ error: 'Student not found or not in your cohorts' });

  const count = await db('exam_sessions')
    .where({ student_id: req.params.studentId })
    .delete();
  res.json({ ok: true, deleted: count });
});

// ── MFA ───────────────────────────────────────────────────────

// GET /api/teacher/mfa/status — is MFA currently enabled?
router.get('/mfa/status', async (req, res) => {
  const teacher = await db('teachers').where({ id: req.user.teacherId }).first();
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  res.json({ mfaEnabled: !!teacher.mfa_enabled });
});

// POST /api/teacher/mfa/setup — generate a new TOTP secret + QR code
// Does NOT enable MFA yet — teacher must verify a code first
router.post('/mfa/setup', async (req, res) => {
  const teacher = await db('teachers').where({ id: req.user.teacherId }).first();
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });

  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(teacher.email, 'CertPath Exam Platform', secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);

  // Store secret in DB (not yet enabled — enabled after verify)
  await db('teachers').where({ id: teacher.id }).update({ mfa_secret: secret, mfa_enabled: false });

  res.json({ secret, qrDataUrl });
});

// POST /api/teacher/mfa/enable — verify code and activate MFA
// Body: { code }
router.post('/mfa/enable', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });

  const teacher = await db('teachers').where({ id: req.user.teacherId }).first();
  if (!teacher || !teacher.mfa_secret) {
    return res.status(400).json({ error: 'No pending MFA setup. Start setup first.' });
  }
  if (teacher.mfa_enabled) {
    return res.status(400).json({ error: 'MFA is already enabled.' });
  }

  const valid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: teacher.mfa_secret });
  if (!valid) return res.status(401).json({ error: 'Invalid code. Make sure your authenticator app is synced.' });

  await db('teachers').where({ id: teacher.id }).update({ mfa_enabled: true });
  res.json({ ok: true, message: 'MFA enabled successfully.' });
});

// POST /api/teacher/mfa/disable — turn off MFA (requires password + current TOTP code)
// Body: { password, code }
router.post('/mfa/disable', async (req, res) => {
  const { password, code } = req.body;
  if (!password || !code) return res.status(400).json({ error: 'Password and code are required' });

  const teacher = await db('teachers').where({ id: req.user.teacherId }).first();
  if (!teacher) return res.status(404).json({ error: 'Teacher not found' });
  if (!teacher.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });

  const validPassword = await bcrypt.compare(password, teacher.password_hash);
  if (!validPassword) return res.status(401).json({ error: 'Incorrect password' });

  const validCode = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: teacher.mfa_secret });
  if (!validCode) return res.status(401).json({ error: 'Invalid authenticator code' });

  await db('teachers').where({ id: teacher.id }).update({ mfa_enabled: false, mfa_secret: null });
  res.json({ ok: true, message: 'MFA disabled.' });
});

// ── CSV helpers ──────────────────────────────────────────────

/**
 * RFC 4180-compliant CSV line parser.
 * Handles quoted fields that contain commas or double-quotes.
 */
function parseCSVLine(line) {
  const values = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        // Escaped double-quote inside a quoted field
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  values.push(current);
  return values.map((v) => v.trim());
}

/**
 * Parse an answer string into an array of uppercase option letters.
 * Handles: "B", "AB", "A, B", "A and B", "A/B", "A, E"
 */
function parseAnswerLetters(answerStr) {
  if (!answerStr) return [];
  return [...new Set(
    (answerStr.match(/[A-F]/gi) || []).map((l) => l.toUpperCase())
  )].sort();
}

/**
 * Detect "(Choose two.)" / "(Select three.)" etc. in question text.
 * Returns the required number of answers, or null if not found.
 */
function detectMaxSelections(questionText) {
  const match = (questionText || '').match(/\(\s*(?:Choose|Select)\s+(\w+)\.?\s*\)/i);
  if (!match) return null;
  const word = match[1].toLowerCase();
  const wordToNum = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return wordToNum[word] || parseInt(word, 10) || null;
}

/**
 * Validate a parsed question object.
 * Returns { ok: boolean, issues: string[], normalizedAnswer: string, detectedMaxSelections: number|null }
 */
function validateParsedQuestion(q) {
  const issues = [];
  const optionLabels = (q.options || []).map((o) => o.label.toUpperCase());
  const answerLetters = parseAnswerLetters(q.correct_answer || '');

  // Check for suspiciously short or missing option texts (sign of bad CSV split)
  for (const opt of (q.options || [])) {
    const text = (opt.text || '').trim();
    if (/^(and|or|,|\.|with)\b/i.test(text)) {
      issues.push(`Option ${opt.label} text starts with a joining word ("${text.slice(0, 40)}") — likely a CSV comma-split error.`);
    }
    if (text.length < 2 && text !== '') {
      issues.push(`Option ${opt.label} text is suspiciously short: "${text}"`);
    }
  }

  // Flag any answer letter that doesn't exist as an actual option in this question.
  // e.g. answer "B, E" with only A-D options → E flagged because it has no option text.
  // This catches exports where the answer references a choice the CSV didn't include.
  for (const letter of answerLetters) {
    if (!optionLabels.includes(letter)) {
      issues.push(
        `Answer references option "${letter}" but that option does not exist in this question (options present: ${optionLabels.join(', ')}).`
      );
    }
  }

  // Must have at least 2 options with real text
  const realOpts = (q.options || []).filter((o) => (o.text || '').trim().length > 2);
  if (realOpts.length < 2) {
    issues.push(`Question has fewer than 2 valid options (found ${realOpts.length}).`);
  }

  // Check "(Choose N.)" / "(Select N.)" vs actual answer count
  const detectedMax = detectMaxSelections(q.question);
  if (detectedMax !== null && answerLetters.length > 0 && answerLetters.length < detectedMax) {
    const numWords = ['one', 'two', 'three', 'four', 'five', 'six'];
    const numWord = numWords[detectedMax - 1] || String(detectedMax);
    issues.push(
      `Question says "(Choose ${numWord})" requiring ${detectedMax} answer${detectedMax !== 1 ? 's' : ''}, but only ${answerLetters.length} found ("${q.correct_answer || ''}").`
    );
  }

  return {
    ok: issues.length === 0,
    issues,
    normalizedAnswer: answerLetters.join('') || (q.correct_answer || '').toUpperCase(),
    detectedMaxSelections: detectedMax,
  };
}

// ── QUESTIONS ────────────────────────────────────────────────

// GET /api/teacher/questions/download — export teacher's own questions as CSV
// ?examTypeId=N  → filter to one exam type (optional)
// ?status=all|published|drafts  (default: all)
router.get('/questions/download', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  if (!teacherId) return res.status(403).json({ error: 'Teacher account required' });

  const { examTypeId, status = 'all' } = req.query;

  let query = db('questions')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .where('questions.teacher_id', teacherId)
    .orderBy('questions.id', 'asc')
    .select(
      'questions.id', 'questions.question', 'questions.options',
      'questions.correct_answer', 'questions.explanation', 'questions.reference_url',
      'questions.domain', 'questions.draft', 'questions.active',
      'questions.question_type', 'questions.max_selections',
      'exam_types.name as examTypeName'
    );

  if (examTypeId) query = query.where('questions.exam_type_id', Number(examTypeId));
  if (status === 'published') query = query.where('questions.draft', false);
  if (status === 'drafts')    query = query.where('questions.draft', true);

  const questions = await query;

  // Build CSV
  const csvEscape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const headers = [
    'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f',
    'correct_answer', 'explanation', 'domain', 'reference_url',
    'question_type', 'max_selections', 'exam_type', 'status',
  ];

  const rows = questions.map((q) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || []);
    const getOpt = (lbl) => opts.find((o) => o.label === lbl)?.text || '';
    return [
      q.question,
      getOpt('A'), getOpt('B'), getOpt('C'), getOpt('D'), getOpt('E'), getOpt('F'),
      q.correct_answer,
      q.explanation,
      q.domain,
      q.reference_url,
      q.question_type || 'single',
      q.max_selections || 1,
      q.examTypeName || '',
      q.draft ? 'draft' : 'published',
    ].map(csvEscape).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = examTypeId ? `questions_exam${examTypeId}.csv` : 'my_questions.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// GET /api/teacher/questions — list
// ?drafts=true  → show only this teacher's drafts (ignores bank filter)
// ?bank=mine|admin|all  → filter published questions (draft=false only)
router.get('/questions', async (req, res) => {
  const { bank = 'all', examTypeId, page = 1, limit = 50, offset: rawOffset, drafts = 'false' } = req.query;
  // Allow explicit offset param for cursor-based pagination (dynamic loading)
  const offset = rawOffset != null ? Number(rawOffset) : (Number(page) - 1) * Number(limit);
  const showDrafts = drafts === 'true';
  const teacherId = req.user.teacherId || null;

  let query = db('questions')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .select('questions.id', 'questions.question', 'questions.domain', 'questions.has_answer',
      'questions.active', 'questions.draft', 'questions.owner_type', 'questions.teacher_id',
      'questions.correct_answer', 'questions.options', 'questions.explanation',
      'questions.reference_url', 'questions.question_type', 'questions.max_selections',
      'questions.import_status', 'questions.import_issue',
      'questions.created_at', 'questions.exam_type_id',
      'exam_types.name as examTypeName');

  if (showDrafts) {
    // Return only THIS teacher's drafts — bank filter is irrelevant here
    // Exclude flagged/improper questions; those are fetched separately via /questions/flagged
    query = query
      .where('questions.draft', true)
      .where('questions.owner_type', 'teacher')
      .where('questions.teacher_id', teacherId)
      .where(function () {
        this.whereNull('questions.import_status').orWhere('questions.import_status', 'ok');
      });
  } else {
    // Published questions only
    query = query.where('questions.draft', false);

    if (bank === 'mine') {
      query = query.where('questions.owner_type', 'teacher').where('questions.teacher_id', teacherId);
    } else if (bank === 'admin') {
      query = query.where('questions.owner_type', 'admin');
    } else {
      // all: admin questions + this teacher's questions
      if (teacherId) {
        query = query.where((q) =>
          q.where('questions.owner_type', 'admin')
            .orWhere((q2) => q2.where('questions.owner_type', 'teacher').where('questions.teacher_id', teacherId))
        );
      } else {
        query = query.where('questions.owner_type', 'admin');
      }
    }
  }

  if (examTypeId) query = query.where('questions.exam_type_id', examTypeId);

  const total = await query.clone().clearSelect().count('questions.id as n').first();
  const questions = await query.orderBy('questions.created_at', 'desc').limit(Number(limit)).offset(Number(offset));

  res.json({ questions, total: Number(total?.n || 0) });
});

// GET /api/teacher/questions/flagged — return this teacher's improper-format drafts
router.get('/questions/flagged', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  const questions = await db('questions')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .select('questions.id', 'questions.question', 'questions.domain', 'questions.options',
      'questions.correct_answer', 'questions.explanation', 'questions.reference_url',
      'questions.import_status', 'questions.import_issue', 'questions.exam_type_id',
      'questions.question_type', 'questions.max_selections', 'questions.created_at',
      'exam_types.name as examTypeName')
    .where('questions.draft', true)
    .where('questions.owner_type', 'teacher')
    .where('questions.teacher_id', teacherId)
    .where('questions.import_status', 'review')
    .orderBy('questions.created_at', 'desc');
  res.json({ questions, total: questions.length });
});

// DELETE /api/teacher/questions/flagged/bulk — bulk-delete flagged questions
router.delete('/questions/flagged/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const teacherId = await resolveTeacherId(req.user);
  const deleted = await db('questions')
    .whereIn('id', ids)
    .where({ owner_type: 'teacher', teacher_id: teacherId, import_status: 'review' })
    .delete();
  res.json({ deleted });
});

// PATCH /api/teacher/questions/:id/approve — move a flagged question to regular drafts
router.patch('/questions/:id/approve', async (req, res) => {
  const { id } = req.params;
  const teacherId = await resolveTeacherId(req.user);
  const existing = await db('questions').where({ id }).first();
  if (!existing) return res.status(404).json({ error: 'Not found' });
  if (existing.teacher_id !== teacherId) return res.status(403).json({ error: 'Forbidden' });
  const [updated] = await db('questions').where({ id })
    .update({ import_status: 'ok', import_issue: null, updated_at: new Date() })
    .returning('*');
  res.json(updated);
});

// POST /api/teacher/questions — create single question (published immediately)
router.post('/questions', async (req, res) => {
  const { question, options, correctAnswer, explanation, referenceUrl, examTypeId } = req.body;
  if (!question || !options) return res.status(400).json({ error: 'question and options are required' });
  if (!Array.isArray(options) || options.length < 2) return res.status(400).json({ error: 'At least 2 options required' });

  const [q] = await db('questions').insert({
    question: question.trim(),
    options: JSON.stringify(options),
    correct_answer: correctAnswer || null,
    explanation: explanation || null,
    reference_url: referenceUrl || null,
    domain: 'Uncategorized',
    exam_type_id: examTypeId || null,
    has_answer: !!correctAnswer,
    active: true,
    draft: false,
    owner_type: 'teacher',
    teacher_id: req.user.teacherId || null,
  }).returning('*');

  res.status(201).json(q);
});

// PUT /api/teacher/questions/:id — edit an existing question
router.put('/questions/:id', async (req, res) => {
  const { id } = req.params;
  const teacherId = req.user.teacherId || null;

  const existing = await db('questions').where({ id }).first();
  if (!existing) return res.status(404).json({ error: 'Question not found' });
  // Admins can edit any; teachers can only edit their own
  if (!req.user.isAdmin && !(existing.owner_type === 'teacher' && existing.teacher_id === teacherId)) {
    return res.status(403).json({ error: 'You can only edit your own questions' });
  }

  const { question, options, correctAnswer, explanation, referenceUrl, examTypeId, active } = req.body;
  const update = {};
  if (question !== undefined) update.question = question.trim();
  if (options !== undefined) { update.options = JSON.stringify(options); }
  if (correctAnswer !== undefined) { update.correct_answer = correctAnswer || null; update.has_answer = !!correctAnswer; }
  if (explanation !== undefined) update.explanation = explanation;
  if (referenceUrl !== undefined) update.reference_url = referenceUrl;
  if (examTypeId !== undefined) update.exam_type_id = examTypeId || null;
  if (active !== undefined) update.active = active;
  update.updated_at = new Date();

  const [updated] = await db('questions').where({ id }).update(update).returning('*');
  res.json(updated);
});

// DELETE /api/teacher/questions/bulk — delete multiple own questions
router.delete('/questions/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const teacherId = req.user.teacherId || null;
  // Only delete questions owned by this teacher
  const deleted = await db('questions')
    .whereIn('id', ids)
    .where({ owner_type: 'teacher', teacher_id: teacherId })
    .delete();
  res.json({ deleted });
});

// POST /api/teacher/questions/upload — bulk JSON or CSV → saved as drafts
router.post('/questions/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const teacherId = await resolveTeacherId(req.user);
  const { examTypeId } = req.body;
  const uploadedPath = req.file.path;
  const ext = path.extname(req.file.originalname).toLowerCase();

  try {
    let questions = [];

    if (ext === '.json') {
      const raw = JSON.parse(fs.readFileSync(uploadedPath, 'utf8'));
      questions = Array.isArray(raw) ? raw : [];
    } else if (ext === '.csv') {
      const content = fs.readFileSync(uploadedPath, 'utf8');
      const lines = content.split('\n').map((l) => l.trim()).filter(Boolean);
      // Use proper RFC 4180 parser for the header row
      const headers = parseCSVLine(lines[0]).map((h) => h.replace(/"/g, '').toLowerCase());
      for (let i = 1; i < lines.length; i++) {
        const vals = parseCSVLine(lines[i]);
        const row = Object.fromEntries(headers.map((h, j) => [h, vals[j] || '']));
        if (!row.question) continue;
        const rawLine = lines[i]; // preserve raw CSV for diagnosis
        const opts = [
          { label: 'A', text: row.option_a || row.a || '' },
          { label: 'B', text: row.option_b || row.b || '' },
          { label: 'C', text: row.option_c || row.c || '' },
          { label: 'D', text: row.option_d || row.d || '' },
          { label: 'E', text: row.option_e || row.e || '' },
          { label: 'F', text: row.option_f || row.f || '' },
        ].filter((o) => o.text.trim());
        const rawAnswer = (row.correct_answer || row.answer || '').trim();
        questions.push({
          question: row.question,
          options: opts,
          correct_answer: rawAnswer || null,
          explanation: row.explanation || '',
          domain: row.domain || 'Cloud Concepts',
          reference_url: row.reference_url || '',
          _rawLine: rawLine,
        });
      }
    } else {
      return res.status(400).json({ error: 'Only JSON or CSV supported for bulk upload' });
    }

    // Separate valid from flagged questions
    const goodQuestions = [];
    const flaggedQuestions = [];

    for (const q of questions) {
      if (!q.question || !q.options || q.options.length < 2) continue;
      const validation = validateParsedQuestion(q);
      if (validation.ok) {
        // Normalize the answer to concatenated letters ("A, E" → "AE")
        q.correct_answer = validation.normalizedAnswer || q.correct_answer;
        q._detectedMax = validation.detectedMaxSelections;
        goodQuestions.push(q);
      } else {
        q._issues = validation.issues;
        q._normalizedAnswer = validation.normalizedAnswer;
        q._detectedMax = validation.detectedMaxSelections;
        flaggedQuestions.push(q);
      }
    }

    // Normalize domains for valid questions
    const normalized = examTypeId
      ? await normalizeDomainsBulk(goodQuestions, examTypeId)
      : goodQuestions;

    // Also normalize flagged questions' domains (best effort)
    const normalizedFlagged = examTypeId
      ? await normalizeDomainsBulk(flaggedQuestions, examTypeId)
      : flaggedQuestions;

    let imported = 0;
    for (const q of normalized) {
      const letters = parseAnswerLetters(q.correct_answer || '');
      // Use detected "(Choose N.)" as max_selections if available, else infer from answer
      const effectiveMax = q._detectedMax || (letters.length > 1 ? letters.length : (q.max_selections || 1));
      const isMulti = effectiveMax > 1;
      await db('questions').insert({
        question: q.question.trim(),
        options: JSON.stringify(q.options),
        correct_answer: q.correct_answer || null,
        explanation: q.explanation || '',
        reference_url: q.reference_url || '',
        domain: q.domain,
        exam_type_id: examTypeId || null,
        has_answer: !!(q.correct_answer),
        active: false,
        draft: true,
        owner_type: 'teacher',
        teacher_id: teacherId,
        question_type: isMulti ? 'multi' : (q.question_type || 'single'),
        max_selections: effectiveMax,
        import_status: 'ok',
      });
      imported++;
    }

    // Insert flagged questions with import_status='review' and raw diagnosis info
    let flagged = 0;
    for (const q of normalizedFlagged) {
      const letters = parseAnswerLetters(q._normalizedAnswer || q.correct_answer || '');
      const isMulti = letters.length > 1;
      await db('questions').insert({
        question: q.question.trim(),
        options: JSON.stringify(q.options),
        correct_answer: q.correct_answer || null,
        explanation: q.explanation || '',
        reference_url: q.reference_url || '',
        domain: q.domain,
        exam_type_id: examTypeId || null,
        has_answer: false, // flagged questions are not trusted yet
        active: false,
        draft: true,
        owner_type: 'teacher',
        teacher_id: teacherId,
        question_type: isMulti ? 'multi' : (q.question_type || 'single'),
        max_selections: isMulti ? letters.length : (q.max_selections || 1),
        import_status: 'review',
        import_issue: JSON.stringify({ issues: q._issues, raw: q._rawLine || '' }),
      });
      flagged++;
    }

    fs.unlinkSync(uploadedPath);
    const message = flagged > 0
      ? `${imported} questions saved as drafts. ${flagged} question${flagged !== 1 ? 's' : ''} flagged for review (improper format).`
      : `${imported} questions saved as drafts. Review them before publishing.`;
    res.json({ imported, flagged, drafts: true, message });
  } catch (err) {
    try { fs.unlinkSync(uploadedPath); } catch {}
    res.status(500).json({ error: err.message });
  }
});

// POST /api/teacher/questions/convert — convert PDF/Word/image → save drafts (background job)
router.post('/questions/convert', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
  const ext = path.extname(req.file.originalname).toLowerCase();
  const allowed = ['.pdf', '.docx', '.doc', '.png', '.jpg', '.jpeg'];
  if (!allowed.includes(ext)) {
    try { fs.unlinkSync(req.file.path); } catch {}
    return res.status(400).json({ error: `Unsupported file type. Allowed: ${allowed.join(', ')}` });
  }

  const teacherId = await resolveTeacherId(req.user);
  const { examTypeId, password } = req.body;
  const uploadedPath = req.file.path;
  const extClean = ext.replace('.', '');
  const scriptPath = path.join(__dirname, '../../scripts/convert_questions.py');
  const jobId = crypto.randomUUID();
  const progressFile = `/tmp/conv-${jobId}.progress`;

  const args = [scriptPath, uploadedPath, extClean, '--progress-file', progressFile];
  if (password) args.push(password);

  const job = {
    status: 'processing',
    pagesDone: 0,
    pagesTotal: null,
    imported: 0,
    error: null,
    progressFile,
    uploadedPath,
    stdout: '',
    stderr: '',
  };
  conversionJobs.set(jobId, job);

  const py = spawn('python3', args);
  py.stdout.on('data', (d) => { job.stdout += d; });
  py.stderr.on('data', (d) => { job.stderr += d; });

  py.on('close', async (code) => {
    try { fs.unlinkSync(uploadedPath); } catch {}
    try { fs.unlinkSync(progressFile); } catch {}

    if (code !== 0) {
      job.status = 'error';
      job.error = (job.stderr || 'Conversion failed').slice(0, 400);
      return;
    }

    let parsed;
    try { parsed = JSON.parse(job.stdout); } catch {
      job.status = 'error';
      job.error = 'Failed to parse converter output. Check file format.';
      return;
    }

    if (parsed?.error) { job.status = 'error'; job.error = parsed.error; return; }
    if (!Array.isArray(parsed) || !parsed.length) {
      job.status = 'error';
      job.error = 'No questions extracted. Ensure the file follows the expected format.';
      return;
    }

    // Filter and normalize domains before inserting
    const validParsed = parsed.filter((q) => q.question && q.question.trim().length >= 15 && q.options && q.options.length >= 2);
    const normalizedParsed = examTypeId
      ? await normalizeDomainsBulk(validParsed, examTypeId)
      : validParsed;

    let imported = 0;
    for (const q of normalizedParsed) {
      try {
        await db('questions').insert({
          question: q.question.trim(),
          options: JSON.stringify(q.options),
          correct_answer: q.correct_answer || null,
          explanation: q.explanation || '',
          reference_url: q.reference_url || '',
          domain: q.domain,
          exam_type_id: examTypeId || null,
          has_answer: !!(q.correct_answer),
          active: false,
          draft: true,
          owner_type: 'teacher',
          teacher_id: teacherId,
          question_type: q.question_type || 'single',
          max_selections: q.max_selections || 1,
        });
        imported++;
      } catch (insertErr) {
        console.error('Insert failed:', insertErr.message);
      }
    }

    job.status = 'done';
    job.imported = imported;
    // Auto-cleanup after 10 minutes
    setTimeout(() => conversionJobs.delete(jobId), 10 * 60 * 1000);
  });

  // Return immediately with job ID
  res.status(202).json({ jobId, status: 'processing' });
});

router.get('/conversion-jobs/:id', async (req, res) => {
  const job = conversionJobs.get(req.params.id);
  if (!job) return res.status(404).json({ error: 'Job not found or expired' });

  // Sync progress from file
  try {
    const raw = fs.readFileSync(job.progressFile, 'utf8');
    const prog = JSON.parse(raw);
    if (prog) { job.pagesDone = prog.pages_done; job.pagesTotal = prog.pages_total; }
  } catch {}

  res.json({
    status: job.status,
    pagesDone: job.pagesDone,
    pagesTotal: job.pagesTotal,
    imported: job.imported,
    error: job.error,
  });
});

// PUT /api/teacher/questions/:id — full edit of own question
router.put('/questions/:id', async (req, res) => {
  const q = await db('questions').where({ id: req.params.id }).first();
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.owner_type !== 'teacher' || String(q.teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { question, options, correctAnswer, explanation, domain, referenceUrl, examTypeId } = req.body;
  const updates = {};
  if (question) updates.question = question.trim();
  if (options && Array.isArray(options)) updates.options = JSON.stringify(options);
  if (correctAnswer !== undefined) {
    updates.correct_answer = correctAnswer || null;
    updates.has_answer = !!correctAnswer;
  }
  if (explanation !== undefined) updates.explanation = explanation;
  if (domain) updates.domain = domain;
  if (referenceUrl !== undefined) updates.reference_url = referenceUrl;
  if (examTypeId) updates.exam_type_id = examTypeId;

  await db('questions').where({ id: req.params.id }).update(updates);
  res.json({ ok: true });
});

// POST /api/teacher/questions/publish/bulk — publish multiple draft questions at once
router.post('/questions/publish/bulk', async (req, res) => {
  const { ids } = req.body;
  if (!Array.isArray(ids) || ids.length === 0) return res.status(400).json({ error: 'ids array required' });
  const teacherId = await resolveTeacherId(req.user);
  const updated = await db('questions')
    .whereIn('id', ids)
    .where({ owner_type: 'teacher', teacher_id: teacherId, draft: true })
    .update({ draft: false, active: true });
  res.json({ published: updated });
});

// PATCH /api/teacher/questions/:id/publish — publish a draft question
router.patch('/questions/:id/publish', async (req, res) => {
  const q = await db('questions').where({ id: req.params.id }).first();
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.owner_type !== 'teacher' || String(q.teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  await db('questions').where({ id: req.params.id }).update({ draft: false, active: true, has_answer: !!q.correct_answer });
  res.json({ ok: true });
});

// PATCH /api/teacher/questions/:id — toggle active (own questions only)
router.patch('/questions/:id', async (req, res) => {
  const q = await db('questions').where({ id: req.params.id }).first();
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.owner_type === 'teacher' && String(q.teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Access denied' });
  }
  const { active } = req.body;
  await db('questions').where({ id: req.params.id }).update({ active: !!active });
  res.json({ ok: true });
});

// DELETE /api/teacher/questions/:id
router.delete('/questions/:id', async (req, res) => {
  const q = await db('questions').where({ id: req.params.id }).first();
  if (!q) return res.status(404).json({ error: 'Not found' });
  if (q.owner_type !== 'teacher' || String(q.teacher_id) !== String(req.user.teacherId)) {
    return res.status(403).json({ error: 'Can only delete your own questions' });
  }
  await db('questions').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ── Teacher Exam Types ───────────────────────────────────────

// GET /api/teacher/exam-types — all active exam types (for dropdowns)
router.get('/exam-types', async (req, res) => {
  const types = await db('exam_types').where({ active: true }).orderBy('name').select('*');
  res.json(types);
});

// GET /api/teacher/exam-types/:id/domains — domain list for a specific exam type
router.get('/exam-types/:id/domains', async (req, res) => {
  const domains = await db('exam_domains')
    .where({ exam_type_id: req.params.id })
    .orderBy('sort_order')
    .select('id', 'name', 'weight_percent', 'sort_order');
  res.json(domains);
});

// ── Teacher Results ───────────────────────────────────────────

// GET /api/teacher/results — all submitted exam_sessions for this teacher's students
// Query params: page (default 1), limit (default 30), mode (exam|practice|all), passed (true|false|all), search (email/name)
router.get('/results', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  if (!teacherId) return res.status(403).json({ error: 'Teacher account required' });

  const page  = Math.max(1, parseInt(req.query.page)  || 1);
  const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 30));
  const offset = (page - 1) * limit;
  const modeFilter   = req.query.mode   || 'all';
  const passedFilter = req.query.passed || 'all';
  const search       = (req.query.search || '').trim().toLowerCase();

  // Get IDs of all students registered by this teacher
  const studentIds = await db('students')
    .where({ registered_by_teacher_id: teacherId })
    .pluck('id');

  if (!studentIds.length) return res.json({ results: [], total: 0, page, limit });

  let query = db('exam_sessions')
    .join('students', 'exam_sessions.student_id', 'students.id')
    .leftJoin('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .whereIn('exam_sessions.student_id', studentIds)
    .whereNotNull('exam_sessions.submitted_at')
    .where('exam_sessions.cancelled', false)
    .select(
      'exam_sessions.id',
      'exam_sessions.mode',
      'exam_sessions.score',
      'exam_sessions.passed',
      'exam_sessions.submitted_at',
      'students.id as studentId',
      'students.name as studentName',
      'students.email as studentEmail',
      'exam_types.name as examName',
      'exam_types.passing_score as passingScore'
    )
    .orderBy('exam_sessions.submitted_at', 'desc');

  if (modeFilter === 'exam' || modeFilter === 'practice') {
    query = query.where('exam_sessions.mode', modeFilter);
  }
  if (passedFilter === 'true')  query = query.where('exam_sessions.passed', true);
  if (passedFilter === 'false') query = query.where('exam_sessions.passed', false);
  if (search) {
    query = query.where(function () {
      this.whereRaw('LOWER(students.email) LIKE ?', [`%${search}%`])
        .orWhereRaw('LOWER(students.name) LIKE ?', [`%${search}%`]);
    });
  }

  // Count total without pagination
  const countQuery = query.clone().clearSelect().clearOrder().count('exam_sessions.id as total').first();
  const [rows, countRow] = await Promise.all([query.limit(limit).offset(offset), countQuery]);
  const total = parseInt((countRow || {}).total) || 0;

  res.json({ results: rows, total, page, limit });
});

// POST /api/teacher/exam-types — teacher creates a new exam type
router.post('/exam-types', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  const { code, name, description, questionsPerExam, timeLimitMinutes, passingScore } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

  const trimCode = code.trim().toLowerCase();
  const exists = await db('exam_types').where({ code: trimCode }).first();
  if (exists) return res.status(409).json({ error: `Exam code "${trimCode}" already exists` });

  const [row] = await db('exam_types').insert({
    code: trimCode,
    name: name.trim(),
    description: description || null,
    questions_per_exam: questionsPerExam || 65,
    time_limit_minutes: timeLimitMinutes || 90,
    passing_score: passingScore || 700,
    active: true,
    created_by_teacher_id: teacherId,
  }).returning('*');

  const et = row && typeof row === 'object' && row.id ? row : await db('exam_types').where({ code: trimCode }).first();
  res.status(201).json(et);
});

// DELETE /api/teacher/exam-types/:id — teacher can only delete their own exam types
router.delete('/exam-types/:id', async (req, res) => {
  const teacherId = await resolveTeacherId(req.user);
  const et = await db('exam_types').where({ id: req.params.id }).first();
  if (!et) return res.status(404).json({ error: 'Exam type not found' });
  if (String(et.created_by_teacher_id) !== String(teacherId)) {
    return res.status(403).json({ error: 'You can only delete exam types you created' });
  }
  await db('exam_types').where({ id: req.params.id }).update({ active: false });
  res.json({ ok: true });
});

module.exports = router;
