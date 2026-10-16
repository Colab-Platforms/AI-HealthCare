/**
 * Pre-fill the MetricKnowledge store so the first real reports are already fast.
 *
 *     node scripts/seedMetricKnowledge.js            # seed every known marker
 *     node scripts/seedMetricKnowledge.js --dry-run  # list what would be generated
 *
 * Safe to re-run: markers that already exist (Mongo) are skipped, and rows are
 * only ever inserted ($setOnInsert), never overwritten. Needs MONGODB_URI (or
 * USE_STAGING_DB + MONGODB_URI_STAGING) and ANTHROPIC_API_KEY. It also builds
 * the unique index on `key`, which autoIndex won't do in production.
 */
const path = require('path');
require('dotenv').config();
require('dotenv').config({ path: path.join(__dirname, '..', '.env') });

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const MetricKnowledge = require('../models/MetricKnowledge');
const { METRIC_ALIASES } = require('../utils/metricNormalizer');
const { resolveMetricKnowledge, knowledgeKey } = require('../services/metricKnowledgeService');

// Common markers that are not in the alias table (names as labs usually print them).
const EXTRA_MARKERS = [
  'Basophils', 'Absolute Neutrophil Count', 'Absolute Lymphocyte Count', 'Mean Platelet Volume',
  'Average Blood Glucose', 'Fasting Insulin', 'HOMA-IR',
  'Apolipoprotein A1', 'Apolipoprotein B', 'Lipoprotein(a)', 'Cholesterol/HDL Ratio', 'LDL/HDL Ratio',
  'Homocysteine', 'Vitamin B6', 'Vitamin A', 'Vitamin E', 'Vitamin K', 'Zinc', 'Copper', 'Selenium',
  'Transferrin Saturation', 'Serum Iron', 'PSA', 'Testosterone', 'Estradiol', 'Progesterone',
  'FSH', 'LH', 'Prolactin', 'Cortisol', 'DHEA-S', 'Parathyroid Hormone', 'Amylase', 'Lipase',
  'LDH', 'CPK', 'Troponin', 'D-Dimer', 'Fibrinogen', 'PT', 'INR', 'aPTT',
  'Anti-TPO', 'Urine Protein', 'Urine Glucose', 'Urine Albumin/Creatinine Ratio', 'Microalbumin',
];

const BATCH = 16; // names per sequential round — keeps API concurrency polite

(async () => {
  const dryRun = process.argv.includes('--dry-run');

  const names = [];
  const seen = new Set();
  for (const name of [...Object.keys(METRIC_ALIASES), ...EXTRA_MARKERS]) {
    const key = knowledgeKey(name);
    if (key && !seen.has(key)) { seen.add(key); names.push(name); }
  }

  await connectDB();
  try { await MetricKnowledge.createIndexes(); } catch (e) { console.warn('Index build skipped:', e.message); }

  const existing = new Set((await MetricKnowledge.find({ key: { $in: [...seen] } }).select('key').lean()).map(d => d.key));
  const todo = names.filter(n => !existing.has(knowledgeKey(n)));
  console.log(`${names.length} known markers, ${existing.size} already stored, ${todo.length} to generate.`);

  if (dryRun) {
    console.log(todo.join('\n'));
  } else {
    let created = 0;
    const failed = [];
    for (let i = 0; i < todo.length; i += BATCH) {
      const slice = todo.slice(i, i + BATCH);
      const { map, missing } = await resolveMetricKnowledge(slice);
      created += slice.length - missing.length;
      failed.push(...missing);
      console.log(`  ${Math.min(i + BATCH, todo.length)}/${todo.length} done (${map.size} resolved in this batch)`);
    }
    console.log(`\nSeeded ${created}. Unresolved: ${failed.length}${failed.length ? ` -> ${failed.join(', ')}` : ''}`);
    console.log('Unresolved markers are harmless: they are generated on first sight in a real report.');
  }

  await mongoose.disconnect();
  process.exit(0);
})().catch((err) => {
  console.error('Seed failed:', err.message);
  process.exit(1);
});
