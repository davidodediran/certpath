/**
 * seed_domains.js
 * Seeds canonical exam domains for every known AWS exam type.
 * Run after migrate and after exam types exist:
 *   node backend/scripts/seed_domains.js
 *
 * Safe to re-run — skips exam types that already have domains.
 */
require('dotenv').config();
const db = require('../src/db/connection');
const AWS_EXAM_DOMAINS = require('./seed_domains_data');

async function run() {
  console.log('Seeding AWS exam domains...\n');

  for (const [code, domains] of Object.entries(AWS_EXAM_DOMAINS)) {
    const examType = await db('exam_types').where({ code }).first();
    if (!examType) {
      console.log(`  ⚠  Exam type "${code}" not found — skipping`);
      continue;
    }

    const existing = await db('exam_domains')
      .where({ exam_type_id: examType.id })
      .count('id as n').first();

    if (Number(existing.n) > 0) {
      console.log(`  ✓  ${examType.name} (${code}) — already seeded, skipping`);
      continue;
    }

    await db('exam_domains').insert(
      domains.map((d) => ({ ...d, exam_type_id: examType.id }))
    );
    console.log(`  ✓  ${examType.name} (${code}) — inserted ${domains.length} domains`);
  }

  console.log('\nDone.');
  await db.destroy();
}

run().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
