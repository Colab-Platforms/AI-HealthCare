/**
 * Canonicalises AI-extracted metric names.
 *
 * The analysis model names each marker however the source document spelled it,
 * and lab PDFs are inconsistent — the same test arrives as "T S H
 * Ultrasensitive" (letter-spacing artefacts from PDF text extraction), "TSH",
 * "Thyroid Stimulating Hormone", or "S.TSH" across three reports from the same
 * lab. Those names are used as OBJECT KEYS in `aiAnalysis.metrics`, and every
 * downstream feature looks markers up by that key:
 *
 *   - trend charts            (healthController)
 *   - report-to-report deltas (healthController, gamificationService)
 *   - long-term health score  (longTermHealthScoreService)
 *   - diet generation         (dietRecommendationController)
 *   - nudges / notifications  (nudgeService, notificationRoutes)
 *   - chat citations          (aiService parseCitations)
 *
 * So an unstable key silently breaks all of them: a user's TSH trend restarts
 * from scratch whenever the spelling shifts. Normalising once on write fixes
 * every reader at a single choke point.
 */

// Canonical display name -> aliases. Alias matching is done on a stripped form
// (lowercase, alphanumerics only), so punctuation and spacing don't matter.
const METRIC_ALIASES = {
  // --- Haematology ---
  'Hemoglobin':            ['hb', 'hgb', 'haemoglobin', 'hemoglobin'],
  'RBC Count':             ['rbc', 'rbccount', 'redbloodcell', 'redbloodcellcount', 'totalrbccount'],
  'WBC Count':             ['wbc', 'wbccount', 'whitebloodcell', 'whitebloodcellcount', 'tlc', 'totalleukocytecount', 'totalwbccount'],
  'Platelet Count':        ['platelet', 'platelets', 'plateletcount'],
  'Hematocrit':            ['hct', 'pcv', 'hematocrit', 'haematocrit', 'packedcellvolume'],
  'MCV':                   ['mcv', 'meancorpuscularvolume'],
  'MCH':                   ['mch', 'meancorpuscularhemoglobin'],
  'MCHC':                  ['mchc', 'meancorpuscularhemoglobinconcentration'],
  'RDW':                   ['rdw', 'redcelldistributionwidth'],
  'ESR':                   ['esr', 'erythrocytesedimentationrate'],
  'Neutrophils':           ['neutrophils', 'neutrophil'],
  'Lymphocytes':           ['lymphocytes', 'lymphocyte'],
  'Eosinophils':           ['eosinophils', 'eosinophil'],
  'Monocytes':             ['monocytes', 'monocyte'],

  // --- Diabetes / glucose ---
  'Fasting Blood Sugar':   ['fbs', 'fastingbloodsugar', 'fastingglucose', 'glucosefasting', 'fastingbloodglucose', 'bloodsugarfasting', 'fastingbloodsugarglucose', 'fastingplasmaglucose', 'fpg'],
  'Post Prandial Blood Sugar': ['ppbs', 'postprandialbloodsugar', 'ppblood sugar', 'postprandialglucose', 'pp2bs', 'bloodsugarpostprandial'],
  'Random Blood Sugar':    ['rbs', 'randombloodsugar', 'randomglucose'],
  'HbA1c':                 ['hba1c', 'a1c', 'glycatedhemoglobin', 'glycosylatedhemoglobin', 'glycohemoglobin', 'hba1cglycatedhemoglobin'],

  // --- Thyroid ---
  'TSH':                   ['tsh', 'tshultrasensitive', 'tshultra', 'thyroidstimulatinghormone', 'stsh', 'serumtsh', 'tsh3rdgeneration'],
  'T3':                    ['t3', 'triiodothyronine', 'totalt3'],
  'T4':                    ['t4', 'thyroxine', 'totalt4'],
  'Free T3':               ['ft3', 'freet3', 'freetriiodothyronine'],
  'Free T4':               ['ft4', 'freet4', 'freethyroxine'],

  // --- Lipids ---
  'Total Cholesterol':     ['totalcholesterol', 'cholesteroltotal', 'cholesterol', 'serumcholesterol'],
  'HDL Cholesterol':       ['hdl', 'hdlcholesterol', 'cholesterolhdl', 'hdlc'],
  'LDL Cholesterol':       ['ldl', 'ldlcholesterol', 'cholesterolldl', 'ldlc'],
  'VLDL Cholesterol':      ['vldl', 'vldlcholesterol', 'cholesterolvldl'],
  'Triglycerides':         ['tg', 'triglyceride', 'triglycerides', 'serumtriglycerides'],
  'Non-HDL Cholesterol':   ['nonhdlcholesterol', 'nonhdl'],

  // --- Liver ---
  'SGOT (AST)':            ['sgot', 'ast', 'aspartateaminotransferase', 'sgotaspartateaminotransferase', 'sgotast', 'astsgot'],
  'SGPT (ALT)':            ['sgpt', 'alt', 'alanineaminotransferase', 'sgptalanineaminotransferase', 'sgptalt', 'altsgpt'],
  'SGOT/SGPT Ratio':       ['sgotsgptratio', 'astaltratio', 'sgotsgpt', 'deritisratio'],
  'Alkaline Phosphatase':  ['alp', 'alkalinephosphatase', 'serumalkalinephosphatase'],
  'GGT':                   ['ggt', 'gammagt', 'gammaglutamyltransferase'],
  'Total Bilirubin':       ['totalbilirubin', 'bilirubintotal', 'serumbilirubintotal'],
  'Direct Bilirubin':      ['directbilirubin', 'bilirubindirect', 'conjugatedbilirubin'],
  'Indirect Bilirubin':    ['indirectbilirubin', 'bilirubinindirect', 'unconjugatedbilirubin'],
  'Total Protein':         ['totalprotein', 'serumtotalprotein', 'proteintotal'],
  'Albumin':               ['albumin', 'serumalbumin'],
  'Globulin':              ['globulin', 'serumglobulin'],
  'A/G Ratio':             ['agratio', 'albuminglobulinratio'],

  // --- Kidney ---
  'Creatinine':            ['creatinine', 'serumcreatinine', 'screatinine'],
  'eGFR':                  ['egfr', 'gfr', 'estimatedgfr', 'estimatedglomerularfiltrationrate'],
  'Blood Urea':            ['urea', 'bloodurea', 'serumurea'],
  'BUN':                   ['bun', 'bloodureanitrogen'],
  'Uric Acid':             ['uricacid', 'serumuricacid'],

  // --- Vitamins / minerals ---
  'Vitamin D':             ['vitamind', 'vitd', 'vitamind3', 'vitd3', '25ohvitamind', '25hydroxyvitamind', 'vitamind25hydroxy', '25ohd'],
  'Vitamin B12':           ['vitaminb12', 'vitb12', 'b12', 'cobalamin', 'serumvitaminb12'],
  'Folate':                ['folate', 'folicacid', 'serumfolate'],
  'Iron':                  ['iron', 'serumiron'],
  'Ferritin':              ['ferritin', 'serumferritin'],
  'TIBC':                  ['tibc', 'totalironbindingcapacity'],
  'Calcium':               ['calcium', 'serumcalcium', 'totalcalcium'],
  'Sodium':                ['sodium', 'serumsodium', 'na'],
  'Potassium':             ['potassium', 'serumpotassium', 'k'],
  'Chloride':              ['chloride', 'serumchloride', 'cl'],
  'Magnesium':             ['magnesium', 'serummagnesium'],
  'Phosphorus':            ['phosphorus', 'serumphosphorus', 'phosphate'],

  // --- Vitals / other ---
  'Blood Pressure':        ['bp', 'bloodpressure'],
  'Heart Rate':            ['hr', 'heartrate', 'pulse', 'pulserate'],
  'BMI':                   ['bmi', 'bodymassindex'],
  'CRP':                   ['crp', 'creactiveprotein', 'hscrp', 'highsensitivitycrp'],
};

// Flattened alias -> canonical lookup, built once.
const ALIAS_LOOKUP = new Map();
for (const [canonical, aliases] of Object.entries(METRIC_ALIASES)) {
  ALIAS_LOOKUP.set(stripKey(canonical), canonical);
  for (const alias of aliases) ALIAS_LOOKUP.set(stripKey(alias), canonical);
}

/** Reduce a name to a comparison key: lowercase alphanumerics only. */
function stripKey(name) {
  return String(name).toLowerCase().replace(/[^a-z0-9]/g, '');
}

/**
 * Tidy the raw name before lookup/display.
 * Chiefly repairs PDF text-extraction artefacts: letter-spaced acronyms
 * ("T S H" -> "TSH") and stray spacing around punctuation ("( Glucose)").
 */
function cleanRawName(raw) {
  let name = String(raw).normalize('NFKC').replace(/\s+/g, ' ').trim();

  // Join runs of 2+ single letters separated by spaces: "S G O T" -> "SGOT".
  // \b anchors prevent this from eating the tail of a real word ("Vitamin D").
  name = name.replace(/\b(?:[A-Za-z] ){1,}[A-Za-z]\b/g, (m) => m.replace(/ /g, ''));

  // Spacing around brackets and separators.
  name = name
    .replace(/\(\s+/g, '(')
    .replace(/\s+\)/g, ')')
    .replace(/\s*\/\s*/g, '/')
    .replace(/\s*-\s*/g, '-')
    .replace(/\s+,/g, ',');

  // Strip leading/trailing punctuation and collapse spaces again.
  return name.replace(/^[\s.,:;-]+|[\s.,:;-]+$/g, '').replace(/\s+/g, ' ').trim();
}

/**
 * Canonical name for a raw metric name.
 * Falls back to the cleaned raw name when the marker isn't in the alias table,
 * so unknown markers still benefit from artefact repair and still key stably.
 */
function canonicalMetricName(raw) {
  if (raw === null || raw === undefined) return '';
  const cleaned = cleanRawName(raw);
  if (!cleaned) return '';
  return ALIAS_LOOKUP.get(stripKey(cleaned)) || cleaned;
}

/** How much real content a metric entry carries — used to pick a winner on collision. */
function completeness(metric) {
  if (!metric || typeof metric !== 'object') return 0;
  let score = 0;
  if (metric.value !== undefined && metric.value !== null && metric.value !== '') score += 10;
  for (const field of ['unit', 'status', 'normalRange', 'whatIsThis', 'whatItDoes', 'lowHighImpact']) {
    if (metric[field]) score += 1;
  }
  for (const field of ['topFoods', 'symptoms']) {
    if (Array.isArray(metric[field]) && metric[field].length) score += 1;
  }
  return score;
}

/**
 * Re-key a metrics object by canonical name.
 * Keeps the original label on each entry as `originalName` so the source
 * document's wording isn't lost. On collision the more complete entry wins.
 */
function normalizeMetrics(metrics) {
  if (!metrics || typeof metrics !== 'object' || Array.isArray(metrics)) return metrics;

  const out = {};
  const renames = [];

  for (const [rawName, metric] of Object.entries(metrics)) {
    const canonical = canonicalMetricName(rawName);
    if (!canonical) continue;

    const entry = (metric && typeof metric === 'object' && !Array.isArray(metric))
      ? { ...metric }
      : { value: metric };

    if (canonical !== rawName) {
      entry.originalName = entry.originalName || rawName;
      renames.push(`${rawName} -> ${canonical}`);
    }

    if (out[canonical] === undefined) {
      out[canonical] = entry;
    } else if (completeness(entry) > completeness(out[canonical])) {
      // Keep the richer duplicate, but don't lose the other label.
      entry.originalName = entry.originalName || out[canonical].originalName;
      out[canonical] = entry;
    }
  }

  if (renames.length) {
    console.log(`🔤 [Metrics] Canonicalised ${renames.length} name(s): ${renames.slice(0, 8).join(', ')}${renames.length > 8 ? ', …' : ''}`);
  }

  return out;
}

module.exports = { canonicalMetricName, normalizeMetrics, cleanRawName, METRIC_ALIASES };
