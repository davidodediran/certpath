const express = require('express');
const db = require('../db/connection');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

// GET /api/exam-types — list active exam types with question counts
router.get('/', authMiddleware, async (req, res) => {
  const types = await db('exam_types')
    .where({ active: true })
    .select('*')
    .orderBy('name');

  const withCounts = await Promise.all(
    types.map(async (t) => {
      const total = await db('questions')
        .where({ exam_type_id: t.id, active: true })
        .count('id as n')
        .first();
      const withAnswer = await db('questions')
        .where({ exam_type_id: t.id, has_answer: true, active: true })
        .count('id as n')
        .first();
      return { ...t, totalQuestions: Number(total.n), questionsWithAnswers: Number(withAnswer.n) };
    })
  );

  res.json(withCounts);
});

module.exports = router;
