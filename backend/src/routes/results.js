const express = require('express');
const db = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/results/progress — student's aggregated stats for progress dashboard
router.get('/progress', authMiddleware, async (req, res) => {
  const studentId = req.user.studentId;
  if (!studentId) return res.status(403).json({ error: 'Students only' });

  const allSessions = await db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .where('exam_sessions.student_id', studentId)
    .whereNotNull('exam_sessions.submitted_at')
    .where('exam_sessions.cancelled', false)
    .orderBy('exam_sessions.submitted_at', 'asc')
    .select(
      'exam_sessions.id',
      'exam_sessions.mode',
      'exam_sessions.score',
      'exam_sessions.passed',
      'exam_sessions.submitted_at',
      'exam_sessions.domain_results',
      'exam_types.name as examName',
      'exam_types.passing_score as passingScore',
      'exam_types.code as examCode'
    );

  const examSessions = allSessions.filter((s) => s.mode === 'exam');
  const practiceSessions = allSessions.filter((s) => s.mode === 'practice');
  const examScores = examSessions.map((s) => s.score);

  // Readiness from exam-mode scores only
  let readiness = null;
  let avgExamScore = null;
  let trend = null;

  if (examScores.length > 0) {
    avgExamScore = Math.round(examScores.reduce((a, b) => a + b, 0) / examScores.length);
    const passingScore = examSessions[0]?.passingScore || 700;

    if (avgExamScore >= 800) {
      readiness = { label: 'Exam Ready', sublabel: 'Your scores are well above passing. You are ready!', color: 'green', icon: 'rocket' };
    } else if (avgExamScore >= passingScore) {
      readiness = { label: 'Almost Ready', sublabel: 'You are passing consistently. A bit more practice to build confidence.', color: 'lime', icon: 'check' };
    } else if (avgExamScore >= 600) {
      readiness = { label: 'On Track', sublabel: 'Good progress. Keep practising to push your score above 700.', color: 'yellow', icon: 'trending' };
    } else {
      readiness = { label: 'Needs More Practice', sublabel: 'Focus on weak domains and take more practice sessions.', color: 'red', icon: 'alert' };
    }

    // Trend: compare first half vs second half of exam sessions
    if (examScores.length >= 4) {
      const mid = Math.floor(examScores.length / 2);
      const early = examScores.slice(0, mid).reduce((a, b) => a + b, 0) / mid;
      const recent = examScores.slice(-mid).reduce((a, b) => a + b, 0) / mid;
      const delta = recent - early;
      if (delta > 40) trend = { label: 'Improving', direction: 'up', delta: Math.round(delta) };
      else if (delta < -40) trend = { label: 'Declining', direction: 'down', delta: Math.round(Math.abs(delta)) };
      else trend = { label: 'Stable', direction: 'flat', delta: Math.round(Math.abs(delta)) };
    } else if (examScores.length >= 2) {
      const delta = examScores[examScores.length - 1] - examScores[0];
      if (delta > 30) trend = { label: 'Improving', direction: 'up', delta: Math.round(delta) };
      else if (delta < -30) trend = { label: 'Declining', direction: 'down', delta: Math.round(Math.abs(delta)) };
      else trend = { label: 'Stable', direction: 'flat', delta: 0 };
    }
  }

  // Domain summary from exam sessions
  const domainTotals = {};
  for (const s of examSessions) {
    const dr = typeof s.domain_results === 'string' ? JSON.parse(s.domain_results) : (s.domain_results || {});
    for (const [domain, stats] of Object.entries(dr)) {
      if (!domainTotals[domain]) domainTotals[domain] = { meets: 0, total: 0, correctTotal: 0, questionTotal: 0 };
      domainTotals[domain].total++;
      if (stats.performance === 'Meets Competency') domainTotals[domain].meets++;
      domainTotals[domain].correctTotal += (stats.correct || 0);
      domainTotals[domain].questionTotal += (stats.total || 0);
    }
  }
  const domainSummary = Object.entries(domainTotals).map(([domain, d]) => ({
    domain,
    meetsPct: d.total ? Math.round((d.meets / d.total) * 100) : 0,
    avgPct: d.questionTotal ? Math.round((d.correctTotal / d.questionTotal) * 100) : 0,
  })).sort((a, b) => a.avgPct - b.avgPct);

  // Timeline data for charts (all sessions)
  const timeline = allSessions.map((s) => ({
    date: s.submitted_at,
    score: s.score,
    mode: s.mode,
    passed: s.passed,
    examName: s.examName,
  }));

  // ── Qualification tracking ──────────────────────────────────────
  // A student is "qualified" via EITHER path:
  //   Path A: passed exam mode > 10 times with score ≥ 750
  //   Path B: passed exam mode > 8 times with score ≥ 800
  const passedSessions = examSessions.filter((s) => s.passed);
  const examPassCount  = passedSessions.length;
  const passScoresArr  = passedSessions.map((s) => s.score);
  const avgPassScore   = passScoresArr.length
    ? Math.round(passScoresArr.reduce((a, b) => a + b, 0) / passScoresArr.length)
    : null;
  const totalExams     = examSessions.length;

  const passCount750   = passedSessions.filter((s) => s.score >= 750).length;
  const passCount800   = passedSessions.filter((s) => s.score >= 800).length;
  const isQualified    = passCount750 > 10 || passCount800 > 8;

  const qualificationProgress = {
    passCount:            examPassCount,
    passCount750,
    passCount800,
    // Path A thresholds
    pathA: { required: 11, scoreMin: 750, current: passCount750 },
    // Path B thresholds
    pathB: { required: 9,  scoreMin: 800, current: passCount800 },
    avgPassScore,
    totalAttempts:        totalExams,
    isQualified,
  };

  res.json({
    totalAttempts: allSessions.length,
    examAttempts: examSessions.length,
    practiceAttempts: practiceSessions.length,
    passCount: examPassCount,
    avgExamScore,
    bestScore: examScores.length ? Math.max(...examScores) : null,
    lastScore: examScores.length ? examScores[examScores.length - 1] : null,
    readiness,
    trend,
    domainSummary,
    timeline,
    qualificationProgress,
    isQualified,
  });
});

// GET /api/results — list student's attempts
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.isAdmin) {
    return res.status(403).json({ error: 'Use /api/admin/results for admin' });
  }
  if (!req.user.studentId) {
    return res.status(403).json({ error: 'Students only' });
  }

  const results = await db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .where('exam_sessions.student_id', req.user.studentId)
    .whereNotNull('exam_sessions.submitted_at')
    .orderBy('exam_sessions.submitted_at', 'desc')
    .select(
      'exam_sessions.id',
      'exam_sessions.mode',
      'exam_sessions.score',
      'exam_sessions.passed',
      'exam_sessions.cancelled',
      'exam_sessions.domain_results',
      'exam_sessions.started_at',
      'exam_sessions.submitted_at',
      'exam_types.name as examName',
      'exam_types.passing_score as passingScore'
    );

  res.json(results);
});

// GET /api/results/:id — full result detail
router.get('/:id', authMiddleware, async (req, res) => {
  const session = await db('exam_sessions')
    .join('exam_types', 'exam_sessions.exam_type_id', 'exam_types.id')
    .where('exam_sessions.id', req.params.id)
    .select(
      'exam_sessions.*',
      'exam_types.name as examName',
      'exam_types.passing_score as passingScore',
      'exam_types.questions_per_exam as questionsPerExam'
    )
    .first();

  if (!session) return res.status(404).json({ error: 'Result not found' });

  if (!req.user.isAdmin && session.student_id !== req.user.studentId) {
    // Teachers may view results for students they registered
    if (req.user.teacherId && session.student_id) {
      const ownStudent = await db('students')
        .where({ id: session.student_id, registered_by_teacher_id: req.user.teacherId })
        .first();
      if (!ownStudent) return res.status(403).json({ error: 'Access denied' });
    } else {
      return res.status(403).json({ error: 'Access denied' });
    }
  }

  if (session.student_id) {
    const student = await db('students').where({ id: session.student_id }).select('email').first();
    session.studentEmail = student?.email;
  }

  // Enrich domain_results with weight % and sortOrder from exam_domains.
  // This handles results that were stored before weighted scoring was added
  // (their domain entries don't have weight/sortOrder fields yet).
  const examDomains = await db('exam_domains')
    .where({ exam_type_id: session.exam_type_id })
    .orderBy('sort_order')
    .select('name', 'weight_percent', 'sort_order');

  const domainCfgMap = Object.fromEntries(
    examDomains.map((d) => [d.name, { weight: d.weight_percent ?? null, sortOrder: d.sort_order ?? 999 }])
  );

  const rawDr = typeof session.domain_results === 'string'
    ? JSON.parse(session.domain_results || '{}')
    : (session.domain_results || {});

  const enrichedDr = {};
  for (const [domain, stats] of Object.entries(rawDr)) {
    const cfg = domainCfgMap[domain] || {};
    enrichedDr[domain] = {
      ...stats,
      weight:    stats.weight    ?? cfg.weight    ?? null,
      sortOrder: stats.sortOrder ?? cfg.sortOrder ?? 999,
    };
  }
  session.domain_results = enrichedDr;

  res.json(session);
});

module.exports = router;
