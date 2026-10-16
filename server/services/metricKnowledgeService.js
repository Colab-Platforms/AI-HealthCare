const MetricKnowledge = require('../models/MetricKnowledge');
const cache = require('../utils/cache');
const { canonicalMetricName } = require('../utils/metricNormalizer');
const { robustJsonParse } = require('../utils/aiParser');

/**
 * Metric knowledge resolver — the "almari" behind the fast report pipeline.
 *
 * Lookup order (each layer back-fills the faster ones above it):
 *
 *   L1  process memory (bounded LRU)      ~0.001 ms
 *   L2  Redis via utils/cache             ~1-2 ms   (shared by all instances;
 *                                                    utils/cache falls back to
 *                                                    its own memory store when
 *                                                    Redis is unavailable)
 *   L3  MongoDB `MetricKnowledge`         ~5-20 ms  (source of truth, permanent)
 *   L4  Claude Haiku, batched             ~3-6 s    (first sighting of a marker only)
 *
 * Misses are never cached, and a failed generation is never persisted, so a
 * transient AI error cannot poison the store with an empty or partial entry.
 */

const CACHE_PREFIX = 'metricKnowledge:v1:';
const CACHE_TTL_SECONDS = 30 * 24 * 60 * 60;

const L1_MAX_ENTRIES = 500;
const L1_TTL_MS = 6 * 60 * 60 * 1000;

const GENERATE_CHUNK_SIZE = 8;
const GENERATE_ATTEMPTS = 2;
const GENERATE_TIMEOUT_MS = 45000;
const MAX_KEY_LENGTH = 80;

const KNOWLEDGE_FIELDS = ['whatIsThis', 'whatItDoes', 'lowHighImpact', 'topFoods', 'symptoms'];

// ---------------------------------------------------------------------------
// Keys & validation
// ---------------------------------------------------------------------------

/**
 * Stable lookup key for a raw metric name. Reuses the report pipeline's own
 * canonicaliser so aliases ("Hb", "HGB", "Haemoglobin") share one entry.
 * Returns '' for names that cannot be a real marker (empty / absurdly long).
 */
function knowledgeKey(rawName) {
  const canonical = canonicalMetricName(rawName);
  if (!canonical) return '';
  const key = canonical.toLowerCase().replace(/\s+/g, ' ').trim();
  return key.length > 0 && key.length <= MAX_KEY_LENGTH ? key : '';
}

const cleanText = (value, max) => {
  if (typeof value !== 'string') return '';
  return value.replace(/\s+/g, ' ').trim().slice(0, max);
};

const cleanList = (value, maxItems, maxLen) => {
  if (!Array.isArray(value)) return [];
  return value
    .map(v => cleanText(typeof v === 'string' ? v : '', maxLen))
    .filter(Boolean)
    .slice(0, maxItems);
};

/**
 * Validate and trim a model-produced entry. Returns null unless all three prose
 * fields are present — an entry missing them is worse than none, because it
 * would be cached and then served to every user.
 */
function sanitizeEntry(raw) {
  if (!raw || typeof raw !== 'object') return null;
  const entry = {
    whatIsThis:    cleanText(raw.whatIsThis, 300),
    whatItDoes:    cleanText(raw.whatItDoes, 900),
    lowHighImpact: cleanText(raw.lowHighImpact, 900),
    topFoods:      cleanList(raw.topFoods, 5, 60),
    symptoms:      cleanList(raw.symptoms, 5, 80),
  };
  if (!entry.whatIsThis || !entry.whatItDoes || !entry.lowHighImpact) return null;
  return entry;
}

const toPlainEntry = (doc) => ({
  whatIsThis:    doc.whatIsThis,
  whatItDoes:    doc.whatItDoes,
  lowHighImpact: doc.lowHighImpact,
  topFoods:      Array.isArray(doc.topFoods) ? doc.topFoods : [],
  symptoms:      Array.isArray(doc.symptoms) ? doc.symptoms : [],
});

// ---------------------------------------------------------------------------
// L1 — bounded in-process LRU
// ---------------------------------------------------------------------------

const l1 = new Map(); // key -> { value, expiresAt }

function l1Get(key) {
  const hit = l1.get(key);
  if (!hit) return null;
  if (Date.now() > hit.expiresAt) { l1.delete(key); return null; }
  l1.delete(key);
  l1.set(key, hit);
  return hit.value;
}

function l1Set(key, value) {
  l1.delete(key);
  l1.set(key, { value, expiresAt: Date.now() + L1_TTL_MS });
  while (l1.size > L1_MAX_ENTRIES) l1.delete(l1.keys().next().value);
}

// ---------------------------------------------------------------------------
// L2 + L3 — Redis and Mongo
// ---------------------------------------------------------------------------

async function lookup(keys) {
  const found = new Map();
  let remaining = [];

  for (const key of keys) {
    const hit = l1Get(key);
    if (hit) found.set(key, hit);
    else remaining.push(key);
  }
  if (!remaining.length) return found;

  // One parallel round of Redis reads (utils/cache never throws on a Redis
  // outage — it degrades to its memory store).
  const redisHits = await Promise.all(remaining.map(async (key) => {
    try { return await cache.get(CACHE_PREFIX + key); } catch { return null; }
  }));
  const afterRedis = [];
  remaining.forEach((key, i) => {
    const hit = redisHits[i];
    if (hit && hit.whatItDoes) {
      found.set(key, hit);
      l1Set(key, hit);
    } else {
      afterRedis.push(key);
    }
  });
  remaining = afterRedis;
  if (!remaining.length) return found;

  // One Mongo query for everything Redis missed.
  try {
    const docs = await MetricKnowledge.find({ key: { $in: remaining } }).lean();
    for (const doc of docs) {
      const entry = toPlainEntry(doc);
      found.set(doc.key, entry);
      l1Set(doc.key, entry);
      cache.set(CACHE_PREFIX + doc.key, entry, CACHE_TTL_SECONDS).catch(() => {});
    }
  } catch (err) {
    console.warn('[MetricKnowledge] Mongo lookup failed, treating as miss:', err.message);
  }

  return found;
}

// ---------------------------------------------------------------------------
// L4 — generation (Haiku, batched, de-duplicated across concurrent reports)
// ---------------------------------------------------------------------------

const KNOWLEDGE_SYSTEM_PROMPT = `You write reference notes about medical lab markers for a patient-facing health app.
For EACH marker name you are given, write generic, medically accurate, plain-language information about the marker itself. This is NOT about any person's result — never mention a specific value.

Return ONLY a JSON object:
{
  "metrics": {
    "<marker name exactly as given>": {
      "whatIsThis": "1-line definition of this marker",
      "whatItDoes": "Detailed role this marker plays in the body (2-3 sentences)",
      "lowHighImpact": "What it means for health when this value is low or high (2-3 sentences)",
      "topFoods": ["Food1", "Food2", "Food3"],
      "symptoms": ["Symptom1", "Symptom2"]
    }
  }
}
Rules:
- "topFoods": common foods that help keep this marker in a healthy range.
- "symptoms": symptoms people may notice when this marker is abnormal.
- No diagnoses, no medication names, no doses.
- If a name is not a recognisable medical test/marker, OMIT it from "metrics".`;

// Replaceable in tests so the service can be exercised without the network.
const deps = {
  async generateText(names) {
    // Lazy require: aiService depends on this module, so a top-level require
    // here would create an import cycle.
    const { makeAnthropicRequestDetailed, CLAUDE_HAIKU_MODEL } = require('./aiService');
    const model = process.env.METRIC_KNOWLEDGE_MODEL || CLAUDE_HAIKU_MODEL;
    const { text } = await makeAnthropicRequestDetailed(
      [
        { role: 'system', content: KNOWLEDGE_SYSTEM_PROMPT },
        { role: 'user', content: `Markers:\n${JSON.stringify(names)}` },
      ],
      3000,
      model,
      { feature: 'metric_info' }
    );
    return { text, model };
  },
};

/** Generate + persist one chunk. Never rejects; resolves to Map<key, entry>. */
async function generateChunk(items) {
  const out = new Map();
  const wanted = new Map(items.map(it => [it.key, it.name]));
  let lastError = null;

  for (let attempt = 1; attempt <= GENERATE_ATTEMPTS; attempt++) {
    try {
      const { text, model } = await deps.generateText(items.map(it => it.name));
      const parsed = robustJsonParse(text);
      const returned = parsed && typeof parsed.metrics === 'object' ? parsed.metrics : null;
      if (!returned) throw new Error('model returned no "metrics" object');

      const writes = [];
      for (const [rawName, rawEntry] of Object.entries(returned)) {
        const key = knowledgeKey(rawName);
        if (!wanted.has(key) || out.has(key)) continue; // ignore names we never asked for
        const entry = sanitizeEntry(rawEntry);
        if (!entry) continue;
        out.set(key, entry);
        writes.push({
          updateOne: {
            filter: { key },
            update: { $setOnInsert: { key, displayName: wanted.get(key), ...entry, source: 'ai', model, version: 1 } },
            upsert: true,
          },
        });
      }

      if (writes.length) {
        try {
          await MetricKnowledge.bulkWrite(writes, { ordered: false });
        } catch (err) {
          // E11000 = another instance upserted the same marker first: harmless.
          if (!/E11000/.test(String(err?.message))) {
            console.warn('[MetricKnowledge] Persist failed (served from cache only):', err.message);
          }
        }
        for (const [key, entry] of out) {
          l1Set(key, entry);
          cache.set(CACHE_PREFIX + key, entry, CACHE_TTL_SECONDS).catch(() => {});
        }
        console.log(`📚 [MetricKnowledge] Generated ${out.size}/${items.length} new marker(s): ${[...out.keys()].slice(0, 6).join(', ')}`);
      }
      return out;
    } catch (err) {
      lastError = err;
      if (attempt < GENERATE_ATTEMPTS) await new Promise(r => setTimeout(r, 800));
    }
  }

  console.warn(`[MetricKnowledge] Generation failed for ${items.length} marker(s): ${lastError?.message}`);
  return out;
}

// key -> Promise<entry|null>. Two reports needing the same new marker at the
// same moment share one AI call instead of paying for it twice.
const inflight = new Map();

function ensureGenerated(items) {
  const result = new Map();
  const fresh = [];

  for (const item of items) {
    if (inflight.has(item.key)) result.set(item.key, inflight.get(item.key));
    else fresh.push(item);
  }

  for (let i = 0; i < fresh.length; i += GENERATE_CHUNK_SIZE) {
    const chunk = fresh.slice(i, i + GENERATE_CHUNK_SIZE);
    const chunkPromise = generateChunk(chunk);
    for (const item of chunk) {
      const p = chunkPromise
        .then(map => map.get(item.key) || null)
        .finally(() => inflight.delete(item.key));
      inflight.set(item.key, p);
      result.set(item.key, p);
    }
  }
  return result;
}

const withTimeout = (promise, ms) => new Promise((resolve) => {
  const timer = setTimeout(() => resolve(null), ms);
  promise.then(
    (v) => { clearTimeout(timer); resolve(v); },
    () => { clearTimeout(timer); resolve(null); }
  );
});

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Resolve knowledge for a list of raw metric names.
 * @returns {Promise<{ map: Map<string, object|null>, missing: string[] }>}
 *   `map` is keyed by knowledgeKey(name); `missing` lists raw names that could
 *   not be resolved (generation failed / timed out / not a real marker).
 */
async function resolveMetricKnowledge(rawNames) {
  const items = [];
  const seen = new Set();
  for (const name of rawNames || []) {
    const key = knowledgeKey(name);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    items.push({ key, name: canonicalMetricName(name) });
  }

  const map = new Map();
  if (!items.length) return { map, missing: [] };

  const found = await lookup(items.map(it => it.key));
  for (const [key, entry] of found) map.set(key, entry);

  const misses = items.filter(it => !map.has(it.key));
  if (misses.length) {
    const pending = ensureGenerated(misses);
    await Promise.all([...pending].map(async ([key, promise]) => {
      const entry = await withTimeout(promise, GENERATE_TIMEOUT_MS);
      if (entry) map.set(key, entry);
    }));
  }

  const missing = items.filter(it => !map.has(it.key)).map(it => it.name);
  return { map, missing };
}

/**
 * Return a copy of `metrics` where every entry carries the five knowledge
 * fields. Knowledge wins over anything the analysis model returned; if neither
 * exists the field is '' / [] so the stored shape never varies.
 */
function mergeKnowledgeIntoMetrics(metrics, knowledgeMap) {
  const out = {};
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return out;

  for (const [name, raw] of Object.entries(metrics)) {
    const base = (raw && typeof raw === 'object' && !Array.isArray(raw)) ? raw : { value: raw };
    const known = knowledgeMap.get(knowledgeKey(name));
    const { whatIsThis, whatItDoes, lowHighImpact, topFoods, symptoms, ...rest } = base;

    out[name] = {
      ...rest,
      whatIsThis:    known?.whatIsThis    ?? whatIsThis    ?? '',
      whatItDoes:    known?.whatItDoes    ?? whatItDoes    ?? '',
      lowHighImpact: known?.lowHighImpact ?? lowHighImpact ?? '',
      topFoods:      known?.topFoods      ?? (Array.isArray(topFoods) ? topFoods : []),
      symptoms:      known?.symptoms      ?? (Array.isArray(symptoms) ? symptoms : []),
    };
  }
  return out;
}

/** Drop a marker from L1 + Redis (call after editing/deleting its Mongo row). */
async function invalidateMetricKnowledge(rawName) {
  const key = knowledgeKey(rawName);
  if (!key) return;
  l1.delete(key);
  await cache.delete(CACHE_PREFIX + key);
}

module.exports = {
  resolveMetricKnowledge,
  mergeKnowledgeIntoMetrics,
  invalidateMetricKnowledge,
  knowledgeKey,
  sanitizeEntry,
  KNOWLEDGE_FIELDS,
  // exported for tests / seed script only
  _deps: deps,
  _generateChunk: generateChunk,
  _resetL1: () => l1.clear(),
};
