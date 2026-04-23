require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs = require('fs');
const path = require('path');
const db = require('../src/db/connection');

const QUESTIONS_FILE = path.join(__dirname, '../data/questions.json');
const CLF_CODE = 'clf-c02';

async function seed() {
  console.log('Seeding database...');

  // Ensure CLF-C02 exam type exists
  let [examType] = await db('exam_types').where({ code: CLF_CODE });
  if (!examType) {
    [examType] = await db('exam_types').insert({
      code: CLF_CODE,
      name: 'AWS Certified Cloud Practitioner',
      description: 'Entry-level certification validating overall understanding of the AWS Cloud. Covers Cloud Concepts, Security, Technology, and Billing.',
      questions_per_exam: 65,
      time_limit_minutes: 90,
      passing_score: 700,
      active: true,
    }).returning('*');
    console.log('Created exam type: AWS Certified Cloud Practitioner (CLF-C02)');
  }

  // Load questions from JSON
  if (!fs.existsSync(QUESTIONS_FILE)) {
    console.error('questions.json not found. Run parse_questions.py first.');
    process.exit(1);
  }

  const questions = JSON.parse(fs.readFileSync(QUESTIONS_FILE, 'utf-8'));
  console.log(`Loaded ${questions.length} questions from JSON`);

  // Batch insert (skip existing based on question text hash)
  let inserted = 0;
  let skipped = 0;
  const batchSize = 100;

  for (let i = 0; i < questions.length; i += batchSize) {
    const batch = questions.slice(i, i + batchSize);
    const rows = batch.map((q) => ({
      exam_type_id: examType.id,
      original_number: q.originalNumber || null,
      question: q.question,
      options: JSON.stringify(q.options),
      correct_answer: q.correctAnswer || null,
      explanation: q.explanation || null,
      reference_url: q.referenceUrl || null,
      domain: q.domain,
      has_answer: q.hasAnswer || false,
      source_file: q.sourceFile || null,
      active: true,
    }));

    for (const row of rows) {
      try {
        await db('questions').insert(row);
        inserted++;
      } catch (err) {
        if (err.code === '23505') {
          skipped++; // unique constraint violation
        } else {
          // Log but continue
          skipped++;
        }
      }
    }

    process.stdout.write(`\r  Progress: ${Math.min(i + batchSize, questions.length)}/${questions.length}`);
  }

  console.log(`\nInserted: ${inserted}, Skipped: ${skipped}`);

  // Print stats
  const count = await db('questions').where({ exam_type_id: examType.id }).count('id as n').first();
  const withAnswer = await db('questions').where({ exam_type_id: examType.id, has_answer: true }).count('id as n').first();
  console.log(`Total in DB: ${count.n} (${withAnswer.n} with answers)`);

  await db.destroy();
  console.log('Seed complete.');
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
