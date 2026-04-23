const express = require('express');
const { v4: uuidv4 } = require('uuid');
const db = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// PostgreSQL JSONB columns are automatically parsed by the pg driver.
// This helper handles both the already-parsed case and the raw-string case safely.
function parseJsonField(val, fallback) {
  if (val === null || val === undefined) return fallback !== undefined ? fallback : null;
  if (typeof val === 'string') {
    try { return JSON.parse(val); } catch { return fallback !== undefined ? fallback : null; }
  }
  return val; // already a JS object/array
}

// Legacy fallback weights (used only when exam_domains table has no entries)
const FALLBACK_DOMAIN_WEIGHTS = {
  'Cloud Concepts':              0.24,
  'Security and Compliance':     0.30,
  'Cloud Technology and Services': 0.34,
  'Technology':                  0.34,
  'Billing, Pricing, and Support': 0.12,
  'Billing and Pricing':         0.12,
};

function shuffleArray(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// Check device lockout
async function checkLockout(fingerprintHash, ip) {
  if (!fingerprintHash) return null;
  const now = new Date();
  const lockout = await db('device_lockouts')
    .where('fingerprint_hash', fingerprintHash)
    .where('locked_until', '>', now)
    .orderBy('locked_until', 'desc')
    .first();
  return lockout || null;
}

// POST /api/exams/start
router.post('/start', authMiddleware, async (req, res) => {
  try {
  const { examTypeId, mode } = req.body;
  const fingerprintHash = req.headers['x-device-fingerprint'] || null;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  if (!examTypeId || !mode) {
    return res.status(400).json({ error: 'examTypeId and mode are required' });
  }
  if (!['practice', 'exam'].includes(mode)) {
    return res.status(400).json({ error: 'mode must be practice or exam' });
  }

  // Validate student exists in DB (guard against stale JWTs from old deployments)
  if (req.user.studentId) {
    const studentExists = await db('students').where({ id: req.user.studentId }).first();
    if (!studentExists) {
      return res.status(401).json({ error: 'session_invalid', message: 'Your session is no longer valid. Please log in again.' });
    }
  }

  // Lockout check (exam mode only)
  if (mode === 'exam' && fingerprintHash) {
    const lockout = await checkLockout(fingerprintHash, ip);
    if (lockout) {
      return res.status(403).json({
        error: 'exam_locked',
        message: 'Your access to Exam Mode has been suspended due to anti-cheat violations.',
        lockedUntil: lockout.locked_until,
      });
    }
  }

  // Student attempt-based lockout (3 failed/incomplete exams in one day = 12hr lockout)
  if (mode === 'exam' && req.user?.studentId) {
    const studentId = req.user.studentId;

    // Check existing active lockout
    const attemptLockout = await db('exam_attempt_lockouts')
      .where({ student_id: studentId, exam_type_id: examTypeId })
      .where('locked_until', '>', new Date())
      .orderBy('locked_until', 'desc')
      .first();

    if (attemptLockout) {
      return res.status(423).json({
        error: 'attempt_lockout',
        message: 'You have had too many incomplete exam attempts today. Exam Mode is locked for 12 hours.',
        lockedUntil: attemptLockout.locked_until,
        recommendation: 'practice',
      });
    }

    // Count failed/abandoned exam sessions today
    const todayStart = new Date(); todayStart.setHours(0, 0, 0, 0);
    const failedRow = await db('exam_sessions')
      .where({ student_id: studentId, exam_type_id: examTypeId, mode: 'exam' })
      .where('started_at', '>=', todayStart)
      .where(function () {
        this.where('cancelled', true)
          .orWhere(function () {
            this.whereNull('submitted_at')
              .where('started_at', '<', db.raw("NOW() - INTERVAL '95 minutes'"));
          });
      })
      .count('id as n')
      .first();

    const failedCount = Number(failedRow?.n || 0);
    if (failedCount >= 3) {
      const lockedUntil = new Date(Date.now() + 12 * 60 * 60 * 1000);
      await db('exam_attempt_lockouts').insert({
        student_id: studentId,
        exam_type_id: examTypeId,
        locked_until: lockedUntil,
        attempt_count: failedCount,
        reason: 'too_many_failures',
      });
      return res.status(423).json({
        error: 'attempt_lockout',
        message: 'You have had 3 incomplete exam attempts today. Exam Mode is locked for 12 hours.',
        lockedUntil: lockedUntil,
        recommendation: 'practice',
      });
    }
  }

  // Get exam type
  const examType = await db('exam_types').where({ id: examTypeId, active: true }).first();
  if (!examType) return res.status(404).json({ error: 'Exam type not found' });

  const totalQuestions = examType.questions_per_exam;

  // Determine which question bank to use based on student's cohort setting
  let questionBankFilter = (q) => q.where({ exam_type_id: examTypeId, has_answer: true, active: true });

  if (req.user.studentId) {
    const student = await db('students').where({ id: req.user.studentId }).first();
    if (student?.cohort_id) {
      const cohort = await db('cohorts').where({ id: student.cohort_id }).first();
      const bank = cohort?.question_bank || 'admin';

      // Get teacher IDs for this cohort
      const teacherRows = await db('teacher_cohorts').where({ cohort_id: cohort.id });
      const teacherIds = teacherRows.map((r) => r.teacher_id);

      if (bank === 'admin') {
        questionBankFilter = (q) => q.where({ exam_type_id: examTypeId, has_answer: true, active: true, owner_type: 'admin' });
      } else if (bank === 'teacher' && teacherIds.length) {
        questionBankFilter = (q) => q.where({ exam_type_id: examTypeId, has_answer: true, active: true, owner_type: 'teacher' })
          .whereIn('teacher_id', teacherIds);
      } else if (bank === 'mixed' && teacherIds.length) {
        questionBankFilter = (q) => q.where({ exam_type_id: examTypeId, has_answer: true, active: true })
          .where((qb) => qb.where('owner_type', 'admin').orWhere((qb2) =>
            qb2.where('owner_type', 'teacher').whereIn('teacher_id', teacherIds)));
      }
    }
  }

  // Helper: validate that a question meets the strict quality bar for exam mode
  // (must have explanation, correct_answer, and options with label+text on every entry)
  function isQualityQuestion(q) {
    if (!q.explanation || !String(q.explanation).trim()) return false;
    if (!q.correct_answer || !String(q.correct_answer).trim()) return false;
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : (q.options || []);
    if (!Array.isArray(opts) || opts.length < 2) return false;
    return opts.every((o) => o && o.label && o.text && String(o.label).trim() && String(o.text).trim());
  }

  // Stratified selection by domain — load canonical domains from DB
  // For exam mode: only select questions that meet the quality bar
  let questionQuery = questionBankFilter(db('questions'))
    .select('id', 'question', 'options', 'domain', 'question_type', 'max_selections', 'explanation', 'correct_answer');

  if (mode === 'exam') {
    questionQuery = questionQuery
      .whereNotNull('explanation').whereRaw("explanation <> ''")
      .whereNotNull('correct_answer').whereRaw("correct_answer <> ''");
  }

  let allQuestions = await questionQuery;

  // For exam mode, do a JS-level options-structure check after fetching
  if (mode === 'exam') {
    allQuestions = allQuestions.filter(isQualityQuestion);
  }

  // Group by domain
  const byDomain = {};
  for (const q of allQuestions) {
    if (!byDomain[q.domain]) byDomain[q.domain] = [];
    byDomain[q.domain].push(q);
  }

  // Load domain weights from DB, fall back to hardcoded map
  const dbDomains = await db('exam_domains')
    .where({ exam_type_id: examTypeId })
    .orderBy('sort_order')
    .select('name', 'weight_percent');

  let domainWeights;
  if (dbDomains.length > 0) {
    const total = dbDomains.reduce((s, d) => s + (d.weight_percent || 0), 0);
    domainWeights = Object.fromEntries(
      dbDomains.map((d) => [d.name, total > 0 ? (d.weight_percent || 0) / 100 : 1 / dbDomains.length])
    );
  } else {
    domainWeights = FALLBACK_DOMAIN_WEIGHTS;
  }

  const selected = [];
  let remaining = totalQuestions;

  const domainNames = Object.keys(domainWeights);
  // Also pick from any domains in the bank not in the configured list
  const allBankDomains = Object.keys(byDomain);
  const extraDomains = allBankDomains.filter((d) => !domainWeights[d]);

  for (let di = 0; di < domainNames.length; di++) {
    const domain = domainNames[di];
    const pool = shuffleArray(byDomain[domain] || []);
    const isLast = di === domainNames.length - 1 && extraDomains.length === 0;
    const n = isLast ? remaining : Math.round(totalQuestions * domainWeights[domain]);
    selected.push(...pool.slice(0, n));
    remaining -= Math.min(pool.length, n);
  }

  // If under quota, fill with any remaining quality questions
  if (selected.length < totalQuestions) {
    const selectedIds = new Set(selected.map((q) => q.id));
    let extrasQuery = db('questions')
      .where({ exam_type_id: examTypeId, active: true })
      .whereNotIn('id', [...selectedIds])
      .orderByRaw('RANDOM()')
      .limit(totalQuestions - selected.length)
      .select('id', 'question', 'options', 'domain', 'explanation', 'correct_answer');

    if (mode === 'exam') {
      extrasQuery = extrasQuery
        .whereNotNull('explanation').whereRaw("explanation <> ''")
        .whereNotNull('correct_answer').whereRaw("correct_answer <> ''");
    }

    let extras = await extrasQuery;
    if (mode === 'exam') extras = extras.filter(isQualityQuestion);
    selected.push(...extras);
  }

  const finalQuestions = shuffleArray(selected).slice(0, totalQuestions);

  // Shuffle options per question
  const optionShuffleMap = {};
  const questionsForClient = finalQuestions.map((q) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    const shuffled = shuffleArray(opts);
    optionShuffleMap[q.id] = shuffled.map((o) => o.label); // original label order after shuffle
    return {
      id: q.id,
      question: q.question,
      options: shuffled,
      domain: q.domain,
      question_type: q.question_type || 'single',
      max_selections: q.max_selections || 1,
    };
  });

  // ── AWS-style unscored questions ──────────────────────────────
  // Randomly select N questions as "unscored" (used for research / future bank
  // improvement). The student sees and answers all questions but never knows
  // which are unscored. Score is calculated only from scored questions.
  // Cap: at least 1 scored question must remain.
  const configuredUnscoredCount =
    (examType.unscored_questions_count != null ? examType.unscored_questions_count : 15);
  const unscoredCount = Math.min(configuredUnscoredCount, Math.max(0, finalQuestions.length - 1));
  const unscoredIds = shuffleArray(finalQuestions.map((q) => q.id)).slice(0, unscoredCount);

  // Create session
  const studentId = req.user.isAdmin ? null : req.user.studentId;
  const [session] = await db('exam_sessions').insert({
    student_id: studentId,
    exam_type_id: examTypeId,
    mode,
    question_ids: JSON.stringify(finalQuestions.map((q) => q.id)),
    option_shuffle_map: JSON.stringify(optionShuffleMap),
    unscored_question_ids: JSON.stringify(unscoredIds),
    started_at: new Date(),
    anti_cheat_strikes: 0,
    cancelled: false,
  }).returning('*');

  return res.json({
    sessionId: session.id,
    mode,
    examType: { name: examType.name, timeLimitMinutes: examType.time_limit_minutes },
    questions: questionsForClient,
  });
  } catch (err) {
    console.error('POST /exams/start error:', err.message);
    return res.status(500).json({ error: 'Failed to start exam. Please try again.' });
  }
});

// POST /api/exams/:id/strike  — record anti-cheat strike
router.post('/:id/strike', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { fingerprint } = req.body;
  const ip = req.headers['x-forwarded-for'] || req.socket.remoteAddress;

  const session = await db('exam_sessions').where({ id }).first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.cancelled) return res.status(400).json({ error: 'Session already cancelled' });

  const newStrikes = (session.anti_cheat_strikes || 0) + 1;

  if (newStrikes >= 3) {
    // Cancel the session
    await db('exam_sessions').where({ id }).update({
      anti_cheat_strikes: newStrikes,
      cancelled: true,
      cancel_reason: 'anti_cheat_violation',
      submitted_at: new Date(),
    });

    // Lock device for 24 hours
    if (fingerprint) {
      const lockedUntil = new Date(Date.now() + 24 * 60 * 60 * 1000);
      await db('device_lockouts').insert({
        fingerprint_hash: fingerprint,
        ip_address: ip,
        student_id: session.student_id,
        locked_until: lockedUntil,
        reason: 'Three anti-cheat violations during exam',
      });
    }

    return res.json({
      strikes: newStrikes,
      cancelled: true,
      message: 'Your exam has been cancelled due to repeated integrity violations. You are locked from Exam Mode for 24 hours.',
    });
  }

  await db('exam_sessions').where({ id }).update({ anti_cheat_strikes: newStrikes });

  const warnings = [
    '',
    'Warning 1 of 3: Please stay in the exam window. Leaving again will result in cancellation.',
    'Warning 2 of 3: Final warning! One more violation and your exam will be cancelled immediately.',
  ];

  return res.json({
    strikes: newStrikes,
    cancelled: false,
    message: warnings[newStrikes] || '',
  });
});

// POST /api/exams/:id/submit
router.post('/:id/submit', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const { answers } = req.body; // { questionId: "B", ... }

  const session = await db('exam_sessions').where({ id }).first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.cancelled) {
    return res.status(400).json({ error: 'This exam was cancelled due to integrity violations.' });
  }
  if (session.submitted_at) {
    return res.status(400).json({ error: 'Exam already submitted.' });
  }

  const questionIds = parseJsonField(session.question_ids, []);

  // Fetch correct answers
  const questions = await db('questions')
    .whereIn('id', questionIds)
    .select('id', 'correct_answer', 'domain');

  const qMap = {};
  for (const q of questions) {
    qMap[q.id] = q;
  }

  // ── Exclude unscored questions from score calculation ─────────
  // Backward-compat: old sessions have null → treat all as scored.
  const unscoredIdSet = new Set(parseJsonField(session.unscored_question_ids, []));
  const scoredQuestions = unscoredIdSet.size > 0
    ? questions.filter((q) => !unscoredIdSet.has(q.id))
    : questions;

  let correctCount = 0;
  const domainStats = {};

  for (const q of scoredQuestions) {
    const domain = q.domain;
    if (!domainStats[domain]) domainStats[domain] = { correct: 0, total: 0 };
    domainStats[domain].total++;

    const studentAnswer = (answers[q.id] || '').toUpperCase().split('').sort().join('');
    const correctAnswer = (q.correct_answer || '').toUpperCase().split('').sort().join('');

    if (studentAnswer && studentAnswer === correctAnswer) {
      correctCount++;
      domainStats[domain].correct++;
    }
  }

  const examType = await db('exam_types').where({ id: session.exam_type_id }).first();
  const total = scoredQuestions.length;           // scored questions only
  const totalQuestions = questionIds.length;      // all questions (scored + unscored)

  // ── Domain-weighted scoring ───────────────────────────────────
  // Load the canonical domain list with weights from DB for this exam type.
  // We only count the weight of domains that actually appear in this exam,
  // then re-normalise so the total always sums to 1000.
  const dbDomains = await db('exam_domains')
    .where({ exam_type_id: session.exam_type_id })
    .orderBy('sort_order')
    .select('name', 'weight_percent', 'sort_order');

  // Build a quick lookup: domainName → { weight_percent, sort_order }
  const domainCfgMap = {};
  for (const d of dbDomains) {
    domainCfgMap[d.name] = { weight: d.weight_percent || 0, sortOrder: d.sort_order };
  }

  let score;
  if (dbDomains.length > 0) {
    // Sum the configured weights only for domains that have questions in this exam
    let usedWeightSum = 0;
    let weightedCorrectSum = 0;
    for (const [domain, stats] of Object.entries(domainStats)) {
      const weight = domainCfgMap[domain]?.weight ?? 0;
      usedWeightSum += weight;
      if (stats.total > 0) {
        weightedCorrectSum += (stats.correct / stats.total) * weight;
      }
    }
    // Re-normalise: divide by the sum of weights that were actually used
    score = usedWeightSum > 0
      ? Math.round((weightedCorrectSum / usedWeightSum) * 1000)
      : Math.round((correctCount / total) * 1000);
  } else {
    // Fallback: flat scoring when no domain config exists
    score = Math.round((correctCount / total) * 1000);
  }

  const passed = score >= (examType?.passing_score || 700);

  // ── Domain results with performance classification ────────────
  // Embed weight % and sort order so the frontend can render them
  // dynamically without needing a separate API call.
  // Always include ALL configured domains, even those with no questions
  // in this particular exam draw (they show as "Not Assessed").
  const domainResults = {};

  // First: populate from domains that actually had questions in this exam
  for (const [domain, stats] of Object.entries(domainStats)) {
    const pct = stats.total > 0 ? Math.round((stats.correct / stats.total) * 100) : 0;
    const cfg = domainCfgMap[domain];
    domainResults[domain] = {
      correct: stats.correct,
      total: stats.total,
      percentage: pct,
      performance: pct >= 70 ? 'Meets Competency' : 'Needs Improvement',
      weight: cfg?.weight ?? null,       // e.g. 24  (meaning 24%)
      sortOrder: cfg?.sortOrder ?? 999,
    };
  }

  // Second: add any configured domains that had zero questions in this exam
  for (const d of dbDomains) {
    if (!domainResults[d.name]) {
      domainResults[d.name] = {
        correct: 0,
        total: 0,
        percentage: 0,
        performance: 'Not Assessed',
        weight: d.weight_percent ?? null,
        sortOrder: d.sort_order ?? 999,
      };
    }
  }

  await db('exam_sessions').where({ id }).update({
    submitted_at: new Date(),
    answers: JSON.stringify(answers),
    score,
    passed,
    domain_results: JSON.stringify(domainResults),
  });

  return res.json({
    sessionId: id,
    score,
    passed,
    correctCount,          // correct out of scored questions
    total,                 // scored questions count
    totalQuestions,        // all questions (scored + unscored)
    unscoredCount: unscoredIdSet.size,
    domainResults,
    examName: examType?.name,
    passingScore: examType?.passing_score || 700,
  });
});

// GET /api/exams/:id — recover an in-progress session (for page refresh)
router.get('/:id', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const session = await db('exam_sessions').where({ id }).first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.student_id !== req.user.studentId) return res.status(403).json({ error: 'Forbidden' });
  if (session.submitted_at) return res.status(410).json({ error: 'Session already submitted' });
  if (session.cancelled) return res.status(410).json({ error: 'Session was cancelled' });

  // Re-fetch questions in the original shuffled order (without correct answers)
  const questionIds = session.question_ids || [];
  const optionShuffleMap = session.option_shuffle_map || {};

  const rows = await db('questions')
    .whereIn('id', questionIds)
    .select('id', 'question', 'options', 'domain');

  const rowMap = Object.fromEntries(rows.map((r) => [r.id, r]));

  const questions = questionIds.map((qid) => {
    const q = rowMap[qid];
    if (!q) return null;
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    const shuffleOrder = optionShuffleMap[qid];
    const orderedOpts = shuffleOrder
      ? shuffleOrder.map((lbl) => opts.find((o) => o.label === lbl)).filter(Boolean)
      : opts;
    return { id: q.id, question: q.question, options: orderedOpts, domain: q.domain };
  }).filter(Boolean);

  const examType = await db('exam_types').where({ id: session.exam_type_id }).first();

  return res.json({
    sessionId: session.id,
    mode: session.mode,
    examType: { name: examType?.name, timeLimitMinutes: examType?.time_limit_minutes },
    questions,
    startedAt: session.started_at,
    existingAnswers: session.answers || {},
  });
});

// GET /api/exams/:id/review — review with correct answers (practice: before submit; exam: after submit)
router.get('/:id/review', authMiddleware, async (req, res) => {
  const { id } = req.params;
  const session = await db('exam_sessions').where({ id }).first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (session.mode === 'exam' && !session.submitted_at) return res.status(400).json({ error: 'Exam not yet submitted' });

  const questionIds = parseJsonField(session.question_ids, []);
  const answersMap = parseJsonField(session.answers, {});
  const shuffleMap = parseJsonField(session.option_shuffle_map, {});
  const unscoredIdSet = new Set(parseJsonField(session.unscored_question_ids, []));

  const questions = await db('questions')
    .whereIn('id', questionIds)
    .select('id', 'question', 'options', 'correct_answer', 'explanation', 'reference_url', 'domain', 'question_type', 'max_selections');

  const reviewed = questions.map((q) => {
    const opts = typeof q.options === 'string' ? JSON.parse(q.options) : q.options;
    const studentAns = (answersMap[q.id] || '').toUpperCase().split('').sort().join('');
    const correctAns = (q.correct_answer || '').toUpperCase().split('').sort().join('');
    return {
      id: q.id,
      question: q.question,
      options: opts,
      studentAnswer: answersMap[q.id] || null,
      correctAnswer: q.correct_answer,
      isCorrect: studentAns === correctAns && !!studentAns,
      isUnscored: unscoredIdSet.has(q.id), // true = did not count toward score
      explanation: q.explanation,
      referenceUrl: q.reference_url,
      domain: q.domain,
      question_type: q.question_type || 'single',
      max_selections: q.max_selections || 1,
    };
  });

  // Sort by original question order
  const idOrder = questionIds.map(Number);
  reviewed.sort((a, b) => idOrder.indexOf(a.id) - idOrder.indexOf(b.id));

  res.json(reviewed);
});

// POST /api/exams/:id/activity — save browser activity log for a session
router.post('/:id/activity', authMiddleware, async (req, res) => {
  const { events } = req.body;
  if (!Array.isArray(events) || events.length === 0) return res.json({ saved: 0 });

  // Check table exists to be safe (migration may not have run yet)
  const tableExists = await db.schema.hasTable('exam_activity_logs');
  if (!tableExists) return res.json({ saved: 0, note: 'table_not_ready' });

  const rows = events.map((e) => ({
    session_id: req.params.id,
    event_type: String(e.type || 'unknown').slice(0, 64),
    details: e.details ? String(e.details).slice(0, 512) : null,
    duration_ms: e.durationMs ? Number(e.durationMs) : null,
    occurred_at: e.occurredAt ? new Date(e.occurredAt) : new Date(),
  }));

  await db('exam_activity_logs').insert(rows);
  res.json({ saved: rows.length });
});

module.exports = router;
