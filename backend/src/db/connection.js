require('dotenv').config();
const knex = require('knex');

const url = process.env.DATABASE_URL || '';

// Only enable SSL for cloud-hosted databases (Neon, Supabase, RDS, Railway, etc.)
// Local Docker Compose uses service name 'db' which doesn't support SSL.
const needsSSL =
  url.includes('neon.tech') ||
  url.includes('supabase') ||
  url.includes('amazonaws') ||
  url.includes('railway') ||
  url.includes('sslmode=require');

const db = knex({
  client: 'pg',
  connection: {
    connectionString: url,
    ...(needsSSL ? { ssl: { rejectUnauthorized: false } } : {}),
  },
  pool: { min: 0, max: 10 },
});

module.exports = db;
