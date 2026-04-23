const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { spawn } = require('child_process');
const db = require('../db/connection');
const bcrypt = require('bcryptjs');
const { authenticator } = require('otplib');
const QRCode = require('qrcode');
const { authMiddleware, adminOnly } = require('../middleware/auth');

const { normalizeDomainsBulk } = require('../utils/domainNormalizer');

const router = express.Router();
router.use(authMiddleware, adminOnly);

// Auto-catch async errors for ALL routes in this router.
// Express 4 doesn't forward uncaught async errors to error handlers,
// causing requests to hang silently. This patch fixes that once for all routes.
['get', 'post', 'put', 'patch', 'delete'].forEach((verb) => {
  const original = router[verb].bind(router);
  router[verb] = (path, ...handlers) => original(path, ...handlers.map((h) =>
    typeof h === 'function'
      ? (req, res, next) => Promise.resolve(h(req, res, next)).catch((err) => {
          console.error(`[Admin ${verb.toUpperCase()} ${path}]`, err.message);
          if (err.code === '23505') return res.status(409).json({ error: 'A record with that code or email already exists.' });
          res.status(500).json({ error: err.message || 'Internal server error' });
        })
      : h
  ));
});

const upload = multer({
  dest: path.join(__dirname, '../../uploads/'),
  limits: { fileSize: 100 * 1024 * 1024 }, // 100MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.json', '.csv'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Only PDF, JSON, and CSV files are allowed'));
  },
});

// ─── RESULTS ───────────────────────────────────────────────
// GET /api/admin/results
router.get('/results', async (req, res) => {
  const { email, examType, mode, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  const applyFilters = (q) => {
    if (email) q = q.where('students.email', 'ilike', `%${email}%`);
    if (examType) q = q.where('exam_sessions.exam_type_id', examType);
    if (mode) q = q.where('exam_sessions.mode', mode);
    return q;
  };

  const baseJoins = () => db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .leftJoin('students', 'exam_sessions.student_id', 'students.id')
    .leftJoin('cohorts', 'students.cohort_id', 'cohorts.id')
    .whereNotNull('exam_sessions.submitted_at');

  const total = await applyFilters(baseJoins()).count('exam_sessions.id as n').first();

  const results = await applyFilters(baseJoins())
    .select(
      'exam_sessions.id',
      'exam_sessions.mode',
      'exam_sessions.score',
      'exam_sessions.passed',
      'exam_sessions.cancelled',
      'exam_sessions.anti_cheat_strikes',
      'exam_sessions.started_at',
      'exam_sessions.submitted_at',
      'exam_sessions.domain_results',
      'students.email',
      'cohorts.name as cohortName',
      'exam_types.name as examName',
      'exam_types.passing_score as passingScore'
    )
    .orderBy('exam_sessions.submitted_at', 'desc')
    .limit(limit)
    .offset(offset);

  res.json({ results, total: Number(total.n), page: Number(page), limit: Number(limit) });
});

// GET /api/admin/results/export.csv
router.get('/results/export.csv', async (req, res) => {
  const results = await db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .leftJoin('students', 'exam_sessions.student_id', 'students.id')
    .leftJoin('cohorts', 'students.cohort_id', 'cohorts.id')
    .whereNotNull('exam_sessions.submitted_at')
    .select(
      'students.email',
      'cohorts.name as cohort',
      'exam_types.name as examName',
      'exam_sessions.mode',
      'exam_sessions.score',
      'exam_sessions.passed',
      'exam_sessions.cancelled',
      'exam_sessions.submitted_at',
      'exam_sessions.domain_results'
    )
    .orderBy('exam_sessions.submitted_at', 'desc');

  const header = 'Email,Cohort,Exam,Mode,Score,Passed,Cancelled,Date,Cloud Concepts,Security,Technology,Billing\n';
  const rows = results.map((r) => {
    const dr = r.domain_results || {};
    const cc = dr['Cloud Concepts']?.performance || '';
    const sc = dr['Security and Compliance']?.performance || '';
    const te = dr['Technology']?.performance || '';
    const bi = dr['Billing and Pricing']?.performance || '';
    return [
      r.email, r.cohort, r.examName, r.mode,
      r.score, r.passed ? 'PASS' : 'FAIL',
      r.cancelled ? 'YES' : 'NO',
      r.submitted_at?.toISOString().split('T')[0],
      cc, sc, te, bi,
    ].map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',');
  }).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="exam-results.csv"');
  res.send(header + rows);
});

// ─── QUESTIONS ─────────────────────────────────────────────

// GET /api/admin/questions/download — export all questions for an exam type as CSV
router.get('/questions/download', async (req, res) => {
  const { examTypeId, ownerType } = req.query;

  let query = db('questions')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .leftJoin('teachers', 'questions.teacher_id', 'teachers.id')
    .orderBy('questions.id', 'asc')
    .select(
      'questions.id', 'questions.question', 'questions.options',
      'questions.correct_answer', 'questions.explanation', 'questions.reference_url',
      'questions.domain', 'questions.draft', 'questions.active',
      'questions.question_type', 'questions.max_selections', 'questions.owner_type',
      'exam_types.name as examTypeName',
      'teachers.name as teacherName'
    );

  if (examTypeId) query = query.where('questions.exam_type_id', Number(examTypeId));
  if (ownerType)  query = query.where('questions.owner_type', ownerType);

  const questions = await query;

  const csvEscape = (v) => `"${String(v == null ? '' : v).replace(/"/g, '""')}"`;
  const headers = [
    'id', 'question', 'option_a', 'option_b', 'option_c', 'option_d', 'option_e', 'option_f',
    'correct_answer', 'explanation', 'domain', 'reference_url',
    'question_type', 'max_selections', 'exam_type', 'owner', 'uploaded_by', 'status',
  ];

  const rows = questions.map((q) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options || '[]') : (q.options || []);
    const getOpt = (lbl) => opts.find((o) => o.label === lbl)?.text || '';
    return [
      q.id,
      q.question,
      getOpt('A'), getOpt('B'), getOpt('C'), getOpt('D'), getOpt('E'), getOpt('F'),
      q.correct_answer,
      q.explanation,
      q.domain,
      q.reference_url,
      q.question_type || 'single',
      q.max_selections || 1,
      q.examTypeName || '',
      q.owner_type || 'admin',
      q.teacherName || '',
      q.draft ? 'draft' : 'published',
    ].map(csvEscape).join(',');
  });

  const csv = [headers.join(','), ...rows].join('\n');
  const filename = examTypeId ? `questions_exam${examTypeId}.csv` : 'all_questions.csv';
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send(csv);
});

// GET /api/admin/questions
router.get('/questions', async (req, res) => {
  const { examTypeId, domain, ownerType, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  let query = db('questions')
    .leftJoin('teachers', 'questions.teacher_id', 'teachers.id')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .orderBy('questions.id', 'desc');

  // Separate count query — avoids the PostgreSQL error caused by ORDER BY on a
  // non-aggregated column when count() is added on top of the cloned query.
  let countQuery = db('questions');

  if (examTypeId) {
    query = query.where({ 'questions.exam_type_id': examTypeId });
    countQuery = countQuery.where({ exam_type_id: examTypeId });
  }
  if (domain) {
    query = query.where({ 'questions.domain': domain });
    countQuery = countQuery.where({ domain });
  }
  if (ownerType) {
    query = query.where({ 'questions.owner_type': ownerType });
    countQuery = countQuery.where({ owner_type: ownerType });
  }

  const total = await countQuery.count('id as n').first();
  const questions = await query.limit(limit).offset(offset).select(
    'questions.id',
    'questions.question',
    'questions.domain',
    'questions.has_answer',
    'questions.active',
    'questions.source_file',
    'questions.created_at',
    'questions.owner_type',
    'questions.teacher_id',
    'exam_types.name as examTypeName',
    'teachers.name as teacherName',
    'teachers.email as teacherEmail'
  );
  res.json({ questions, total: Number(total.n) });
});

// GET /api/admin/questions/flagged — all improper-format questions across all teachers
router.get('/questions/flagged', async (req, res) => {
  const { page = 1, limit = 100 } = req.query;
  const offset = (page - 1) * limit;
  const questions = await db('questions')
    .leftJoin('teachers', 'questions.teacher_id', 'teachers.id')
    .leftJoin('exam_types', 'questions.exam_type_id', 'exam_types.id')
    .select(
      'questions.id', 'questions.question', 'questions.domain',
      'questions.options', 'questions.correct_answer', 'questions.explanation',
      'questions.import_status', 'questions.import_issue', 'questions.created_at',
      'questions.exam_type_id', 'questions.question_type', 'questions.max_selections',
      'exam_types.name as examTypeName',
      'teachers.name as teacherName', 'teachers.email as teacherEmail'
    )
    .where('questions.import_status', 'review')
    .where('questions.draft', true)
    .orderBy('questions.created_at', 'desc')
    .limit(Number(limit))
    .offset(Number(offset));
  const total = await db('questions').where({ import_status: 'review', draft: true }).count('id as n').first();
  res.json({ questions, total: Number(total?.n || 0) });
});

// DELETE /api/admin/questions/flagged/:id — admin deletes a flagged question
router.delete('/questions/flagged/:id', async (req, res) => {
  const { id } = req.params;
  const deleted = await db('questions').where({ id, import_status: 'review' }).delete();
  if (!deleted) return res.status(404).json({ error: 'Not found' });
  res.json({ deleted: true });
});

// PATCH /api/admin/questions/:id — toggle active
router.patch('/questions/:id', async (req, res) => {
  const { active } = req.body;
  await db('questions').where({ id: req.params.id }).update({ active: !!active });
  res.json({ ok: true });
});

// POST /api/admin/questions/upload
router.post('/questions/upload', upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No file uploaded' });

  const { examTypeId } = req.body;
  if (!examTypeId) return res.status(400).json({ error: 'examTypeId is required' });

  const ext = path.extname(req.file.originalname).toLowerCase();
  const uploadedPath = req.file.path;

  try {
    if (ext === '.json') {
      // Direct JSON import
      const data = JSON.parse(fs.readFileSync(uploadedPath, 'utf-8'));
      let questions = (Array.isArray(data) ? data : data.questions || []).filter((q) => q.question && q.options);
      // Normalize domains to canonical names for this exam type
      questions = await normalizeDomainsBulk(
        questions.map((q) => ({ ...q, domain: q.domain || 'General' })),
        examTypeId
      );
      let inserted = 0;
      for (const q of questions) {
        await db('questions').insert({
          exam_type_id: examTypeId,
          original_number: q.originalNumber || q.id || null,
          question: q.question,
          options: JSON.stringify(q.options),
          correct_answer: q.correctAnswer || q.correct_answer || null,
          explanation: q.explanation || null,
          reference_url: q.referenceUrl || q.reference_url || null,
          domain: q.domain,
          has_answer: !!(q.correctAnswer || q.correct_answer),
          source_file: req.file.originalname,
          active: true,
          question_type: q.question_type || 'single',
          max_selections: q.max_selections || 1,
        }).onConflict().ignore();
        inserted++;
      }
      fs.unlinkSync(uploadedPath);
      return res.json({ imported: inserted, message: `Imported ${inserted} questions` });
    }

    if (ext === '.pdf') {
      // Run Python parser on the uploaded PDF
      const scriptPath = path.join(__dirname, '../../scripts/parse_pdf_single.py');
      const outputPath = uploadedPath + '.json';

      await new Promise((resolve, reject) => {
        const py = spawn('python3', [scriptPath, uploadedPath, outputPath], {
          env: { ...process.env, PYTHONIOENCODING: 'utf-8' },
        });
        py.on('close', (code) => {
          if (code === 0) resolve();
          else reject(new Error(`Parser exited with code ${code}`));
        });
        py.stderr.on('data', (d) => console.error('Parser:', d.toString()));
      });

      let data = JSON.parse(fs.readFileSync(outputPath, 'utf-8'));
      // Normalize domains
      data = await normalizeDomainsBulk(
        data.map((q) => ({ ...q, domain: q.domain || 'General' })),
        examTypeId
      );
      let inserted = 0;
      for (const q of data) {
        await db('questions').insert({
          exam_type_id: examTypeId,
          original_number: q.originalNumber || null,
          question: q.question,
          options: JSON.stringify(q.options),
          correct_answer: q.correctAnswer || q.correct_answer || null,
          explanation: q.explanation || null,
          reference_url: q.referenceUrl || null,
          domain: q.domain,
          has_answer: !!(q.correctAnswer || q.correct_answer),
          source_file: req.file.originalname,
          active: true,
          question_type: q.question_type || 'single',
          max_selections: q.max_selections || 1,
        }).onConflict().ignore();
        inserted++;
      }
      fs.unlinkSync(uploadedPath);
      fs.unlinkSync(outputPath);
      return res.json({ imported: inserted });
    }

    return res.status(400).json({ error: 'Unsupported file type' });
  } catch (err) {
    try { fs.unlinkSync(uploadedPath); } catch {}
    return res.status(500).json({ error: err.message });
  }
});

// ─── COHORTS ───────────────────────────────────────────────
router.get('/cohorts', async (req, res) => {
  const cohorts = await db('cohorts')
    .leftJoin('exam_types', 'cohorts.exam_type_id', 'exam_types.id')
    .select('cohorts.*', 'exam_types.name as examTypeName')
    .orderBy('cohorts.created_at', 'desc');

  const withCounts = await Promise.all(cohorts.map(async (c) => {
    const count = await db('students').where({ cohort_id: c.id }).count('id as n').first();
    return { ...c, studentCount: Number(count.n) };
  }));

  res.json(withCounts);
});

router.post('/cohorts', async (req, res) => {
  const { code, name, examTypeId } = req.body;
  if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

  const [cohort] = await db('cohorts').insert({
    code: code.trim().toUpperCase(),
    name: name.trim(),
    exam_type_id: examTypeId || null,
    active: true,
  }).returning('*');

  res.status(201).json(cohort);
});

// PATCH /admin/cohorts/:id — toggle active
router.patch('/cohorts/:id', async (req, res) => {
  const { active } = req.body;
  if (typeof active !== 'boolean') return res.status(400).json({ error: 'active (boolean) required' });
  await db('cohorts').where({ id: req.params.id }).update({ active });
  res.json({ ok: true });
});

// DELETE /admin/cohorts/:id — soft deactivate (legacy, keep for compat)
router.delete('/cohorts/:id', async (req, res) => {
  await db('cohorts').where({ id: req.params.id }).update({ active: false });
  res.json({ ok: true });
});

// DELETE /admin/cohorts/:id/permanent — hard delete (only if no students)
router.delete('/cohorts/:id/permanent', async (req, res) => {
  const count = await db('students').where({ cohort_id: req.params.id }).count('id as n').first();
  if (Number(count.n) > 0) {
    return res.status(409).json({ error: `Cannot delete: ${count.n} student(s) are in this cohort` });
  }
  await db('cohorts').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ─── EXAM TYPES ────────────────────────────────────────────
router.get('/exam-types', async (req, res) => {
  try {
    const types = await db('exam_types').orderBy('created_at', 'desc');
    res.json(types);
  } catch (err) {
    console.error('GET /exam-types:', err.message);
    res.status(500).json({ error: 'Failed to load exam types' });
  }
});

router.post('/exam-types', async (req, res) => {
  try {
    const { code, name, description, questionsPerExam, timeLimitMinutes, passingScore } = req.body;
    if (!code || !name) return res.status(400).json({ error: 'code and name are required' });

    const [et] = await db('exam_types').insert({
      code: code.trim().toLowerCase(),
      name: name.trim(),
      description: description || null,
      questions_per_exam: questionsPerExam || 65,
      time_limit_minutes: timeLimitMinutes || 90,
      passing_score: passingScore || 700,
      active: true,
    }).returning('*');

    res.status(201).json(et);
  } catch (err) {
    console.error('POST /exam-types:', err.message);
    if (err.code === '23505') return res.status(409).json({ error: `Exam type with code "${req.body.code}" already exists.` });
    res.status(500).json({ error: err.message || 'Failed to create exam type' });
  }
});

router.patch('/exam-types/:id', async (req, res) => {
  try {
    const { name, description, questionsPerExam, timeLimitMinutes, passingScore, active } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (questionsPerExam !== undefined) updates.questions_per_exam = questionsPerExam;
    if (timeLimitMinutes !== undefined) updates.time_limit_minutes = timeLimitMinutes;
    if (passingScore !== undefined) updates.passing_score = passingScore;
    if (active !== undefined) updates.active = active;

    await db('exam_types').where({ id: req.params.id }).update(updates);
    res.json({ ok: true });
  } catch (err) {
    console.error('PATCH /exam-types:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update exam type' });
  }
});

router.delete('/exam-types/:id', async (req, res) => {
  try {
    await db('exam_types').where({ id: req.params.id }).update({ active: false });
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /exam-types:', err.message);
    res.status(500).json({ error: err.message || 'Failed to deactivate exam type' });
  }
});

// ─── EXAM DOMAINS ──────────────────────────────────────────
const { invalidateCache } = require('../utils/domainNormalizer');

// GET /admin/exam-types/:id/domains
router.get('/exam-types/:id/domains', async (req, res) => {
  try {
    const domains = await db('exam_domains')
      .where({ exam_type_id: req.params.id })
      .orderBy('sort_order')
      .select('*');
    res.json(domains);
  } catch (err) {
    console.error('GET /exam-types/:id/domains:', err.message);
    res.status(500).json({ error: 'Failed to load domains' });
  }
});

// POST /admin/exam-types/:id/domains
router.post('/exam-types/:id/domains', async (req, res) => {
  try {
    const { name, weightPercent, keywords } = req.body;
    if (!name) return res.status(400).json({ error: 'name is required' });

    const maxOrder = await db('exam_domains')
      .where({ exam_type_id: req.params.id })
      .max('sort_order as m').first();
    const sort_order = (maxOrder?.m || 0) + 1;

    const [row] = await db('exam_domains').insert({
      exam_type_id: req.params.id,
      name: name.trim(),
      weight_percent: weightPercent || null,
      keywords: keywords || null,
      sort_order,
    }).returning('*');

    invalidateCache(Number(req.params.id));
    res.status(201).json(row);
  } catch (err) {
    console.error('POST /exam-types/:id/domains:', err.message);
    res.status(500).json({ error: err.message || 'Failed to add domain' });
  }
});

// PUT /admin/exam-domains/:id
router.put('/exam-domains/:id', async (req, res) => {
  try {
    const { name, weightPercent, keywords, sortOrder } = req.body;
    const updates = {};
    if (name !== undefined) updates.name = name.trim();
    if (weightPercent !== undefined) updates.weight_percent = weightPercent;
    if (keywords !== undefined) updates.keywords = keywords;
    if (sortOrder !== undefined) updates.sort_order = sortOrder;

    const [updated] = await db('exam_domains').where({ id: req.params.id }).update(updates).returning('*');
    const examTypeId = updated?.exam_type_id;
    if (examTypeId) invalidateCache(examTypeId);
    res.json(updated);
  } catch (err) {
    console.error('PUT /exam-domains/:id:', err.message);
    res.status(500).json({ error: err.message || 'Failed to update domain' });
  }
});

// DELETE /admin/exam-domains/:id
router.delete('/exam-domains/:id', async (req, res) => {
  try {
    const row = await db('exam_domains').where({ id: req.params.id }).first();
    if (row) invalidateCache(row.exam_type_id);
    await db('exam_domains').where({ id: req.params.id }).delete();
    res.json({ ok: true });
  } catch (err) {
    console.error('DELETE /exam-domains/:id:', err.message);
    res.status(500).json({ error: err.message || 'Failed to delete domain' });
  }
});

// POST /admin/exam-types/:id/domains/seed  — seed AWS defaults for this exam type
router.post('/exam-types/:id/domains/seed', async (req, res) => {
  try {
    const examType = await db('exam_types').where({ id: req.params.id }).first();
    if (!examType) return res.status(404).json({ error: 'Exam type not found' });

    const AWS_DEFAULTS = require('../../scripts/seed_domains_data');
    const domains = AWS_DEFAULTS[examType.code];
    if (!domains) return res.status(404).json({ error: `No default domains defined for exam code "${examType.code}"` });

    await db('exam_domains').where({ exam_type_id: examType.id }).delete();
    await db('exam_domains').insert(domains.map((d) => ({ ...d, exam_type_id: examType.id })));
    invalidateCache(examType.id);

    res.json({ seeded: domains.length });
  } catch (err) {
    console.error('POST /exam-types/:id/domains/seed:', err.message);
    res.status(500).json({ error: err.message || 'Failed to seed domains' });
  }
});

// ─── LOCKOUTS ──────────────────────────────────────────────
router.get('/lockouts', async (req, res) => {
  const lockouts = await db('device_lockouts')
    .leftJoin('students', 'device_lockouts.student_id', 'students.id')
    .where('device_lockouts.locked_until', '>', new Date())
    .select('device_lockouts.*', 'students.email')
    .orderBy('device_lockouts.created_at', 'desc');
  res.json(lockouts);
});

router.delete('/lockouts/:id', async (req, res) => {
  await db('device_lockouts').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ─── SURVEYS ───────────────────────────────────────────────
router.get('/surveys', async (req, res) => {
  const { examTypeId, page = 1, limit = 50 } = req.query;
  const offset = (page - 1) * limit;

  // Build data query
  let query = db('surveys')
    .leftJoin('students', 'surveys.student_id', 'students.id')
    .leftJoin('exam_sessions', 'surveys.exam_session_id', 'exam_sessions.id')
    .leftJoin('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .select('surveys.*', 'students.email', 'exam_types.name as examName')
    .orderBy('surveys.created_at', 'desc');

  // Separate count query — avoids mixing aggregate + non-aggregate columns
  let countQuery = db('surveys')
    .leftJoin('exam_sessions', 'surveys.exam_session_id', 'exam_sessions.id')
    .count('surveys.id as n');

  if (examTypeId) {
    query = query.where('exam_sessions.exam_type_id', examTypeId);
    countQuery = countQuery.where('exam_sessions.exam_type_id', examTypeId);
  }

  const [total, surveys] = await Promise.all([
    countQuery.first(),
    query.limit(limit).offset(offset),
  ]);

  res.json({ surveys, total: Number(total.n) });
});

router.get('/surveys/export.csv', async (req, res) => {
  const surveys = await db('surveys')
    .leftJoin('students', 'surveys.student_id', 'students.id')
    .leftJoin('exam_sessions', 'surveys.exam_session_id', 'exam_sessions.id')
    .leftJoin('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .select('surveys.*', 'students.email', 'exam_types.name as examName')
    .orderBy('surveys.created_at', 'desc');

  const header = 'Email,Exam,Difficulty,Content Quality,Found Unclear,Details,Suggestions,Date\n';
  const rows = surveys.map((s) => [
    s.email, s.examName, s.difficulty_rating, s.content_quality_rating,
    s.found_unclear_questions ? 'Yes' : 'No', s.unclear_details, s.suggestions,
    s.created_at?.toISOString().split('T')[0],
  ].map((v) => `"${(v || '').toString().replace(/"/g, '""')}"`).join(',')).join('\n');

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', 'attachment; filename="surveys.csv"');
  res.send(header + rows);
});

// ─── STUDENTS ──────────────────────────────────────────────
router.get('/students', async (req, res) => {
  const { cohortId } = req.query;
  let query = db('students')
    .leftJoin('cohorts', 'students.cohort_id', 'cohorts.id')
    .select('students.*', 'cohorts.name as cohortName', 'cohorts.code as cohortCode')
    .orderBy('students.created_at', 'desc');
  if (cohortId) query = query.where({ cohort_id: cohortId });
  const students = await query;
  res.json(students);
});

// ─── TEACHERS ──────────────────────────────────────────────
const bcryptTeacher = require('bcryptjs');

router.get('/teachers', async (req, res) => {
  const teachers = await db('teachers').orderBy('created_at', 'desc');
  // Attach assigned cohorts
  const withCohorts = await Promise.all(teachers.map(async (t) => {
    const cohorts = await db('teacher_cohorts')
      .join('cohorts', 'teacher_cohorts.cohort_id', 'cohorts.id')
      .where('teacher_cohorts.teacher_id', t.id)
      .select('cohorts.id', 'cohorts.code', 'cohorts.name');
    return { ...t, password_hash: undefined, cohorts };
  }));
  res.json(withCohorts);
});

router.post('/teachers', async (req, res) => {
  const { name, email, password, cohortIds = [] } = req.body;
  if (!name || !email || !password) return res.status(400).json({ error: 'name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });

  const emailLower = email.trim().toLowerCase();

  // Prevent using admin or superuser email as a teacher — those accounts
  // take priority in the login check and would intercept the teacher login.
  const admin = await db('admin_settings').first();
  if (admin && admin.email.toLowerCase() === emailLower) {
    return res.status(409).json({ error: 'This email belongs to the admin account and cannot be used for a teacher.' });
  }
  const superuser = await db('superusers').where({ active: true }).first();
  if (superuser && superuser.email.toLowerCase() === emailLower) {
    return res.status(409).json({ error: 'This email belongs to the superuser account and cannot be used for a teacher.' });
  }

  const hash = await bcryptTeacher.hash(password, 10);
  const [teacher] = await db('teachers').insert({
    name: name.trim(),
    email: emailLower,
    password_hash: hash,
    active: true,
  }).returning('*');

  if (cohortIds.length) {
    await db('teacher_cohorts').insert(cohortIds.map((cid) => ({ teacher_id: teacher.id, cohort_id: cid })));
  }

  res.status(201).json({ ...teacher, password_hash: undefined });
});

router.put('/teachers/:id', async (req, res) => {
  const { name, email, password, active, cohortIds } = req.body;
  const updates = {};
  if (name) updates.name = name.trim();
  if (email) {
    const emailLower = email.trim().toLowerCase();
    const admin = await db('admin_settings').first();
    if (admin && admin.email.toLowerCase() === emailLower) {
      return res.status(409).json({ error: 'This email belongs to the admin account.' });
    }
    const superuser = await db('superusers').where({ active: true }).first();
    if (superuser && superuser.email.toLowerCase() === emailLower) {
      return res.status(409).json({ error: 'This email belongs to the superuser account.' });
    }
    updates.email = emailLower;
  }
  if (password) {
    if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
    updates.password_hash = await bcryptTeacher.hash(password, 10);
  }
  if (active !== undefined) updates.active = active;

  if (Object.keys(updates).length) {
    await db('teachers').where({ id: req.params.id }).update(updates);
  }

  if (cohortIds !== undefined) {
    await db('teacher_cohorts').where({ teacher_id: req.params.id }).delete();
    if (cohortIds.length) {
      await db('teacher_cohorts').insert(cohortIds.map((cid) => ({ teacher_id: req.params.id, cohort_id: cid })));
    }
  }

  res.json({ ok: true });
});

router.delete('/teachers/:id', async (req, res) => {
  // Null-out teacher references on questions so they aren't orphaned
  await db('questions').where({ teacher_id: req.params.id }).update({ teacher_id: null, owner_type: 'admin' });
  // teacher_cohorts cascade-deletes automatically via FK ON DELETE CASCADE
  await db('teachers').where({ id: req.params.id }).delete();
  res.json({ ok: true });
});

// ─── OVERVIEW STATS ─────────────────────────────────────────
router.get('/stats', async (req, res) => {
  const [students, cohorts, exams, questions, teachers, lockouts] = await Promise.all([
    db('students').count('id as n').first(),
    db('cohorts').where({ active: true }).count('id as n').first(),
    db('exam_sessions').whereNotNull('submitted_at').count('id as n').first(),
    db('questions').where({ active: true }).count('id as n').first(),
    db('teachers').where({ active: true }).count('id as n').first(),
    db('device_lockouts').where('locked_until', '>', new Date()).count('id as n').first(),
  ]);
  res.json({
    students: Number(students.n),
    cohorts: Number(cohorts.n),
    exams: Number(exams.n),
    questions: Number(questions.n),
    teachers: Number(teachers.n),
    lockouts: Number(lockouts.n),
  });
});

// ── MFA ───────────────────────────────────────────────────────

// GET /api/admin/mfa/status
router.get('/mfa/status', async (req, res) => {
  const admin = await db('admin_settings').first();
  res.json({ mfaEnabled: !!(admin?.mfa_enabled) });
});

// POST /api/admin/mfa/setup — generate secret + QR code (does not enable yet)
router.post('/mfa/setup', async (req, res) => {
  const admin = await db('admin_settings').first();
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  const secret = authenticator.generateSecret();
  const otpAuthUrl = authenticator.keyuri(admin.email, 'CertPath Admin', secret);
  const qrDataUrl = await QRCode.toDataURL(otpAuthUrl);
  await db('admin_settings').where({ id: admin.id }).update({ mfa_secret: secret, mfa_enabled: false });
  res.json({ secret, qrDataUrl });
});

// POST /api/admin/mfa/enable — verify first code and activate MFA
router.post('/mfa/enable', async (req, res) => {
  const { code } = req.body;
  if (!code) return res.status(400).json({ error: 'Code is required' });
  const admin = await db('admin_settings').first();
  if (!admin || !admin.mfa_secret) return res.status(400).json({ error: 'Start setup first' });
  if (admin.mfa_enabled) return res.status(400).json({ error: 'MFA is already enabled' });
  const valid = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: admin.mfa_secret });
  if (!valid) return res.status(401).json({ error: 'Invalid code. Make sure your authenticator app is synced.' });
  await db('admin_settings').where({ id: admin.id }).update({ mfa_enabled: true });
  res.json({ ok: true });
});

// POST /api/admin/mfa/disable — requires current password + TOTP code
router.post('/mfa/disable', async (req, res) => {
  const { password, code } = req.body;
  if (!password || !code) return res.status(400).json({ error: 'Password and code are required' });
  const admin = await db('admin_settings').first();
  if (!admin) return res.status(404).json({ error: 'Admin not found' });
  if (!admin.mfa_enabled) return res.status(400).json({ error: 'MFA is not enabled' });
  const validPw = await bcrypt.compare(password, admin.password_hash);
  if (!validPw) return res.status(401).json({ error: 'Incorrect password' });
  const validCode = authenticator.verify({ token: String(code).replace(/\s/g, ''), secret: admin.mfa_secret });
  if (!validCode) return res.status(401).json({ error: 'Invalid authenticator code' });
  await db('admin_settings').where({ id: admin.id }).update({ mfa_enabled: false, mfa_secret: null });
  res.json({ ok: true });
});

module.exports = router;
