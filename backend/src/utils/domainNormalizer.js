/**
 * Domain Normalizer
 *
 * Maps raw domain strings from OCR / CSV uploads to the canonical
 * domain names configured per exam type in the exam_domains table.
 *
 * Algorithm (highest score wins):
 *   100 — exact match (case-insensitive)
 *    80 — one string fully contains the other
 *    60 — any configured keyword appears in the input (or vice versa)
 *    40 — word-level overlap (words > 3 chars)
 *     0 — no match → falls back to first domain
 */

const db = require('../db/connection');

// In-process cache: examTypeId → { domains, ts }
const _cache = new Map();
const CACHE_TTL_MS = 60_000; // 1 minute

async function _loadDomains(examTypeId) {
  // Guard: undefined examTypeId would cause a Knex "Undefined binding" crash
  if (!examTypeId) return [];

  const cached = _cache.get(examTypeId);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) return cached.domains;

  const domains = await db('exam_domains')
    .where({ exam_type_id: examTypeId })
    .orderBy('sort_order')
    .select('name', 'keywords');

  _cache.set(examTypeId, { domains, ts: Date.now() });
  return domains;
}

function _score(input, domain) {
  const inp = input.toLowerCase().trim();
  const name = domain.name.toLowerCase().trim();

  if (inp === name) return 100;
  if (inp.includes(name) || name.includes(inp)) return 80;

  if (domain.keywords) {
    const kws = domain.keywords.split(',').map((k) => k.trim().toLowerCase()).filter(Boolean);
    for (const kw of kws) {
      if (kw && (inp.includes(kw) || kw.includes(inp))) return 60;
    }
  }

  // Word overlap (ignore short words like "and", "of", "the")
  const inputWords = inp.split(/\s+/).filter((w) => w.length > 3);
  const nameWords  = name.split(/\s+/).filter((w) => w.length > 3);
  const overlap = inputWords.filter((w) => nameWords.includes(w)).length;
  if (overlap > 0) return 30 + overlap * 5;

  return 0;
}

/**
 * Normalize a raw domain string to the canonical name for this exam type.
 * Returns the raw value unchanged if the exam type has no configured domains.
 */
async function normalizeDomain(rawDomain, examTypeId) {
  if (!rawDomain) return 'General';
  if (!examTypeId) return rawDomain;

  const domains = await _loadDomains(examTypeId);
  if (!domains.length) return rawDomain;

  let bestScore = -1;
  let bestName  = domains[0].name; // fallback to first domain

  for (const d of domains) {
    const s = _score(rawDomain, d);
    if (s > bestScore) { bestScore = s; bestName = d.name; }
  }

  return bestName;
}

/**
 * Bulk-normalize an array of { domain, ...rest } objects.
 * More efficient: loads domains once per examTypeId.
 */
async function normalizeDomainsBulk(rows, examTypeId) {
  const domains = await _loadDomains(examTypeId);
  if (!domains.length) return rows;

  return rows.map((row) => {
    if (!row.domain) return { ...row, domain: domains[0].name };
    let bestScore = -1;
    let bestName  = domains[0].name;
    for (const d of domains) {
      const s = _score(row.domain, d);
      if (s > bestScore) { bestScore = s; bestName = d.name; }
    }
    return { ...row, domain: bestName };
  });
}

/** Call after adding/editing domains so the next request re-fetches. */
function invalidateCache(examTypeId) {
  if (examTypeId) _cache.delete(examTypeId);
  else _cache.clear();
}

module.exports = { normalizeDomain, normalizeDomainsBulk, invalidateCache };
