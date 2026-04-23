require('dotenv').config();
const db = require('./connection');

async function createIfMissing(tableName, defFn) {
  const exists = await db.schema.hasTable(tableName);
  if (!exists) await db.schema.createTable(tableName, defFn);
}

async function addColumnIfMissing(table, column, defFn) {
  const tableExists = await db.schema.hasTable(table);
  if (!tableExists) return; // table not created yet — skip silently
  const colExists = await db.schema.hasColumn(table, column);
  if (!colExists) await db.schema.alterTable(table, defFn);
}

// Retry loop — Railway Postgres can take a few seconds to accept connections
// after the backend container starts, especially after a cold start or redeploy.
async function waitForDb(maxAttempts = 15, delayMs = 3000) {
  for (let i = 1; i <= maxAttempts; i++) {
    try {
      await db.raw('SELECT 1');
      console.log('[db] Connection established.');
      return;
    } catch (err) {
      console.warn(`[db] Attempt ${i}/${maxAttempts} failed: ${err.message}`);
      if (i === maxAttempts) throw new Error(`Database unreachable after ${maxAttempts} attempts: ${err.message}`);
      await new Promise((r) => setTimeout(r, delayMs));
    }
  }
}

async function migrate() {
  console.log('Running migrations...');
  await waitForDb();

  await db.schema.raw('CREATE EXTENSION IF NOT EXISTS "pgcrypto"');

  await createIfMissing('exam_types', (t) => {
    t.increments('id').primary();
    t.string('code').unique().notNullable();
    t.string('name').notNullable();
    t.text('description');
    t.integer('questions_per_exam').defaultTo(65);
    t.integer('time_limit_minutes').defaultTo(90);
    t.integer('passing_score').defaultTo(700);
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  await createIfMissing('cohorts', (t) => {
    t.increments('id').primary();
    t.string('code').unique().notNullable();
    t.string('name').notNullable();
    t.integer('exam_type_id').references('id').inTable('exam_types').onDelete('SET NULL');
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  // Add question_bank column to cohorts if missing
  await addColumnIfMissing('cohorts', 'question_bank', (t) => {
    t.string('question_bank').defaultTo('admin'); // 'admin' | 'teacher' | 'mixed'
  });

  await createIfMissing('students', (t) => {
    t.increments('id').primary();
    t.string('name');
    t.string('email').unique().notNullable();
    t.integer('cohort_id').references('id').inTable('cohorts').onDelete('SET NULL');
    t.integer('registered_by_teacher_id'); // null = open/admin registration
    t.timestamps(true, true);
  });

  // Add new columns to existing students table
  await addColumnIfMissing('students', 'name', (t) => { t.string('name').nullable(); });
  await addColumnIfMissing('students', 'registered_by_teacher_id', (t) => {
    t.integer('registered_by_teacher_id').nullable();
  });

  // MFA columns for students
  await addColumnIfMissing('students', 'mfa_secret', (t) => { t.text('mfa_secret').nullable(); });
  await addColumnIfMissing('students', 'mfa_enabled', (t) => { t.boolean('mfa_enabled').defaultTo(false); });

  await createIfMissing('questions', (t) => {
    t.increments('id').primary();
    t.integer('exam_type_id').references('id').inTable('exam_types').onDelete('CASCADE');
    t.integer('original_number');
    t.text('question').notNullable();
    t.jsonb('options').notNullable();
    t.string('correct_answer');
    t.text('explanation');
    t.string('reference_url', 1000);
    t.string('domain').notNullable();
    t.boolean('has_answer').defaultTo(false);
    t.boolean('active').defaultTo(true);
    t.boolean('draft').defaultTo(false);
    t.string('source_file');
    t.string('owner_type').defaultTo('admin'); // 'admin' | 'teacher'
    t.integer('teacher_id');                   // null for admin-owned
    t.timestamps(true, true);
  });

  // Add ownership + draft columns to existing questions table
  await addColumnIfMissing('questions', 'owner_type', (t) => {
    t.string('owner_type').defaultTo('admin');
  });
  await addColumnIfMissing('questions', 'teacher_id', (t) => {
    t.integer('teacher_id').nullable();
  });
  await addColumnIfMissing('questions', 'draft', (t) => {
    t.boolean('draft').defaultTo(false);
  });

  // Multi-select question support
  await addColumnIfMissing('questions', 'question_type', (t) => {
    t.string('question_type').defaultTo('single'); // 'single' | 'multi'
  });
  await addColumnIfMissing('questions', 'max_selections', (t) => {
    t.integer('max_selections').defaultTo(1); // how many options the student may select
  });

  // Import quality tracking — questions that fail validation are flagged for review
  await addColumnIfMissing('questions', 'import_status', (t) => {
    t.string('import_status', 20).defaultTo('ok'); // 'ok' | 'review'
  });
  await addColumnIfMissing('questions', 'import_issue', (t) => {
    t.text('import_issue').nullable(); // JSON: { issues: [...], raw: "..." }
  });

  await createIfMissing('exam_sessions', (t) => {
    t.uuid('id').primary().defaultTo(db.raw('gen_random_uuid()'));
    t.integer('student_id').references('id').inTable('students').onDelete('CASCADE');
    t.integer('exam_type_id').references('id').inTable('exam_types').onDelete('SET NULL');
    t.string('mode').notNullable();
    t.jsonb('question_ids');
    t.jsonb('option_shuffle_map');
    t.timestamp('started_at').defaultTo(db.fn.now());
    t.timestamp('submitted_at');
    t.jsonb('answers');
    t.integer('score');
    t.boolean('passed');
    t.boolean('cancelled').defaultTo(false);
    t.string('cancel_reason');
    t.jsonb('domain_results');
    t.integer('anti_cheat_strikes').defaultTo(0);
    t.timestamps(true, true);
  });

  await createIfMissing('surveys', (t) => {
    t.increments('id').primary();
    t.integer('student_id').references('id').inTable('students').onDelete('CASCADE');
    t.uuid('exam_session_id').references('id').inTable('exam_sessions').onDelete('CASCADE');
    t.integer('difficulty_rating');
    t.integer('content_quality_rating');
    t.boolean('found_unclear_questions');
    t.text('unclear_details');
    t.text('suggestions');
    t.timestamps(true, true);
  });

  await createIfMissing('device_lockouts', (t) => {
    t.increments('id').primary();
    t.string('fingerprint_hash').notNullable();
    t.string('ip_address');
    t.integer('student_id').references('id').inTable('students').onDelete('CASCADE');
    t.timestamp('locked_until').notNullable();
    t.string('reason');
    t.timestamps(true, true);
  });

  await createIfMissing('admin_settings', (t) => {
    t.increments('id').primary();
    t.string('email').notNullable();
    t.string('password_hash').notNullable();
    t.timestamps(true, true);
  });

  // MFA columns for admin
  await addColumnIfMissing('admin_settings', 'mfa_secret', (t) => {
    t.text('mfa_secret').nullable();
  });
  await addColumnIfMissing('admin_settings', 'mfa_enabled', (t) => {
    t.boolean('mfa_enabled').defaultTo(false);
  });

  await createIfMissing('teachers', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('email').unique().notNullable();
    t.string('password_hash').notNullable();
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  // MFA columns for teachers
  await addColumnIfMissing('teachers', 'mfa_secret', (t) => {
    t.text('mfa_secret').nullable();
  });
  await addColumnIfMissing('teachers', 'mfa_enabled', (t) => {
    t.boolean('mfa_enabled').defaultTo(false);
  });

  await createIfMissing('teacher_cohorts', (t) => {
    t.integer('teacher_id').references('id').inTable('teachers').onDelete('CASCADE');
    t.integer('cohort_id').references('id').inTable('cohorts').onDelete('CASCADE');
    t.primary(['teacher_id', 'cohort_id']);
  });

  // Superuser — has all admin powers + can manage admins
  await createIfMissing('superusers', (t) => {
    t.increments('id').primary();
    t.string('name').notNullable();
    t.string('email').unique().notNullable();
    t.string('password_hash').notNullable();
    t.boolean('active').defaultTo(true);
    t.timestamps(true, true);
  });

  // MFA columns for superusers — MUST be after createIfMissing('superusers')
  await addColumnIfMissing('superusers', 'mfa_secret', (t) => {
    t.text('mfa_secret').nullable();
  });
  await addColumnIfMissing('superusers', 'mfa_enabled', (t) => {
    t.boolean('mfa_enabled').defaultTo(false);
  });

  // Exam domains — canonical domains per exam type with normalization keywords
  await createIfMissing('exam_domains', (t) => {
    t.increments('id').primary();
    t.integer('exam_type_id').references('id').inTable('exam_types').onDelete('CASCADE').notNullable();
    t.string('name').notNullable();          // canonical domain name
    t.integer('weight_percent').nullable();  // e.g. 24 for 24%
    t.integer('sort_order').defaultTo(0);
    t.text('keywords').nullable();           // comma-separated normalization keywords
    t.timestamps(true, true);
  });

  // Track which teacher created an exam type (null = admin-created)
  await addColumnIfMissing('exam_types', 'created_by_teacher_id', (t) => {
    t.integer('created_by_teacher_id').nullable();
  });

  // Track which teacher created a cohort (null = admin-created)
  await addColumnIfMissing('cohorts', 'created_by_teacher_id', (t) => {
    t.integer('created_by_teacher_id').nullable();
  });

  // AWS-style unscored questions: how many questions per exam session are
  // randomly selected as unscored (not counted toward the student's score).
  // AWS uses 15 out of 65. Students never know which ones are unscored.
  await addColumnIfMissing('exam_types', 'unscored_questions_count', (t) => {
    t.integer('unscored_questions_count').defaultTo(15);
  });

  // Per-session record of which question IDs were unscored for that attempt.
  // NULL on old sessions = all scored (fully backward-compatible).
  await addColumnIfMissing('exam_sessions', 'unscored_question_ids', (t) => {
    t.jsonb('unscored_question_ids').nullable();
  });

  // ── Back-fill multi-select question metadata ──────────────────
  // Questions imported before question_type / max_selections columns existed
  // have NULL for both, so the UI always shows radio buttons.
  // Fix: any question whose correct_answer contains more than one letter
  // (e.g. "BD", "ACE") is definitively multi-select — set the fields from
  // the answer data. Idempotent: skips rows already marked 'multi'.
  await db.raw(`
    UPDATE questions
    SET
      question_type   = 'multi',
      max_selections  = LENGTH(REGEXP_REPLACE(correct_answer, '[^A-Za-z]', '', 'g'))
    WHERE
      correct_answer  IS NOT NULL
      AND LENGTH(REGEXP_REPLACE(correct_answer, '[^A-Za-z]', '', 'g')) > 1
      AND (question_type IS NULL OR question_type <> 'multi')
  `);
  console.log('[migrate] Back-filled multi-select question_type / max_selections.');

  // Drop global unique constraint on cohorts.code so teachers can reuse codes across accounts
  await db.schema.raw(`
    DO $$ BEGIN
      IF EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'cohorts_code_unique' AND conrelid = 'cohorts'::regclass
      ) THEN
        ALTER TABLE cohorts DROP CONSTRAINT cohorts_code_unique;
      END IF;
    END $$;
  `);

  // Exam attempt lockouts — lock student from exam mode after 3 failed attempts in a day
  await createIfMissing('exam_attempt_lockouts', (t) => {
    t.increments('id').primary();
    t.integer('student_id').references('id').inTable('students').onDelete('CASCADE');
    t.integer('exam_type_id').references('id').inTable('exam_types').onDelete('CASCADE');
    t.timestamp('locked_until').notNullable();
    t.integer('attempt_count').defaultTo(3);
    t.string('reason').defaultTo('too_many_failures');
    t.timestamps(true, true);
  });

  // Exam activity logs — browser/app activity recorded during an exam session
  await createIfMissing('exam_activity_logs', (t) => {
    t.increments('id').primary();
    t.uuid('session_id').references('id').inTable('exam_sessions').onDelete('CASCADE').notNullable();
    t.string('event_type').notNullable(); // 'tab_switch','window_blur','fullscreen_exit','devtools','clipboard_block','key_block'
    t.text('details');                    // human-readable description
    t.integer('duration_ms');             // how long the away-period lasted (for blur/tab events)
    t.timestamp('occurred_at').defaultTo(db.fn.now());
    t.timestamps(true, true);
  });

  console.log('Migrations complete.');

  // ── Auto-seed essential data ────────────────────────────────────────────────
  // This runs after every startup. All checks are idempotent (insert only if
  // missing), so existing data is never touched. This ensures the app is always
  // usable even after a database wipe (e.g. Railway free-tier Postgres reset).

  await seedEssentialData();

  await db.destroy();
}

async function seedEssentialData() {
  const bcrypt = require('bcryptjs');

  // 1. Admin account
  const adminCount = await db('admin_settings').count('id as n').first();
  if (Number(adminCount.n) === 0) {
    const email    = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (!email || !password) throw new Error('ADMIN_EMAIL and ADMIN_PASSWORD env vars are required on first run');
    const hash = await bcrypt.hash(password, 10);
    await db('admin_settings').insert({ email, password_hash: hash });
    console.log(`[seed] Admin account created → ${email}`);
  }

  // 2. Superuser account
  const suCount = await db('superusers').count('id as n').first();
  if (Number(suCount.n) === 0) {
    const email    = process.env.SUPER_EMAIL;
    const password = process.env.SUPER_PASSWORD;
    if (!email || !password) throw new Error('SUPER_EMAIL and SUPER_PASSWORD env vars are required on first run');
    const hash = await bcrypt.hash(password, 10);
    await db('superusers').insert({ name: 'Super Admin', email, password_hash: hash, active: true });
    console.log(`[seed] Superuser account created → ${email}`);
  }

  // 3. Default exam type (CLF-C02) — so the app is not empty on first login
  const etCount = await db('exam_types').count('id as n').first();
  if (Number(etCount.n) === 0) {
    const [et] = await db('exam_types').insert({
      code: 'clf-c02',
      name: 'AWS Cloud Practitioner (CLF-C02)',
      description: 'Entry-level AWS certification covering cloud concepts, security, technology, and billing.',
      questions_per_exam: 65,
      time_limit_minutes: 90,
      passing_score: 700,
      active: true,
    }).returning('*');

    // Seed the four standard CLF-C02 domains
    await db('exam_domains').insert([
      { exam_type_id: et.id, name: 'Cloud Concepts',          weight_percent: 24, sort_order: 1, keywords: 'cloud,concepts,value proposition,economics,cloud architecture' },
      { exam_type_id: et.id, name: 'Security and Compliance', weight_percent: 30, sort_order: 2, keywords: 'security,compliance,shared responsibility,iam,encryption,shield,waf' },
      { exam_type_id: et.id, name: 'Cloud Technology',        weight_percent: 34, sort_order: 3, keywords: 'technology,services,compute,storage,database,networking,ec2,s3,rds,lambda' },
      { exam_type_id: et.id, name: 'Billing and Pricing',     weight_percent: 12, sort_order: 4, keywords: 'billing,pricing,cost,free tier,calculator,support,organizations' },
    ]);
    console.log('[seed] Default exam type CLF-C02 + domains created');
  }

  console.log('[seed] Essential data check complete.');
}

migrate().catch((err) => {
  console.error('Migration failed:', err.stack || err.message);
  process.exit(1);
});
