const express = require('express');
const db = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// POST /api/surveys
router.post('/', authMiddleware, async (req, res) => {
  const { examSessionId, difficultyRating, contentQualityRating, foundUnclearQuestions, unclearDetails, suggestions } = req.body;

  if (!examSessionId) {
    return res.status(400).json({ error: 'examSessionId is required' });
  }

  // Verify session belongs to student
  const session = await db('exam_sessions').where({ id: examSessionId }).first();
  if (!session) return res.status(404).json({ error: 'Session not found' });
  if (!req.user.isAdmin && session.student_id !== req.user.studentId) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Check if survey already submitted for this session
  const existing = await db('surveys').where({ exam_session_id: examSessionId }).first();
  if (existing) {
    return res.status(409).json({ error: 'Survey already submitted for this session' });
  }

  const [survey] = await db('surveys').insert({
    student_id: req.user.studentId || null,
    exam_session_id: examSessionId,
    difficulty_rating: difficultyRating || null,
    content_quality_rating: contentQualityRating || null,
    found_unclear_questions: foundUnclearQuestions || false,
    unclear_details: unclearDetails || null,
    suggestions: suggestions || null,
  }).returning('*');

  res.status(201).json(survey);
});

module.exports = router;
