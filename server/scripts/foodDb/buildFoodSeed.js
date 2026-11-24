/**
 * Build the `foods` seed from the two source Excel files.
 * Rules: docs/FOOD_DB_FLOW.md section 4.
 *
 * Usage (from server/):
 *   node scripts/foodDb/buildFoodSeed.js
 *   node scripts/foodDb/buildFoodSeed.js --src ../client/public/food-db --out data/foodDb
 *
 * Output:
 *   <out>/foods.seed.json          array of Food documents (no _id), ready to import
 *   <out>/foods.build-report.json  counts, merges, flagged/disabled rows, serving fixes
 *
 * Deterministic: the same input files always produce the same output (incl. foodIds).
 */
const path = require('path');
const fs = require('fs');
const ExcelJS = require('exceljs');
const { tokens, normalize, similarity, tokenOverlap } = require('../../services/foodDb/normalize');
const C = require('../../services/foodDb/classify');
const checks = require('../../services/foodDb/foodChecks');

// ── args ────────────────────────────────────────────────────────────────────
const arg = (name, def) => {
  const i = process.argv.indexOf(name);
  return i > -1 ? process.argv[i + 1] : def;
};
const SERVER_DIR = path.resolve(__dirname, '..', '..');
const SRC_DIR = path.resolve(SERVER_DIR, arg('--src', '../client/public/food-db'));
const OUT_DIR = path.resolve(SERVER_DIR, arg('--out', 'data/foodDb'));
const ANUVAAD_FILE = path.join(SRC_DIR, 'Anuvaad_INDB_2024.11.xlsx');
const IND_FILE = path.join(SRC_DIR, 'Indian_Food_DB_independent_schema.xlsx');

// ── thresholds (section 4.2 / 4.3) ──────────────────────────────────────────
const MERGE_MIN_SIMILARITY = 0.9; // spelling similarity of the whole name
const MERGE_MIN_WORD_OVERLAP = 0.75; // and most words must actually match
const KCAL_TOLERANCE = 0.25; // relative; per-100 g limits live in services/foodDb/foodChecks.js

// ── serving units (section 4.4) ─────────────────────────────────────────────
// [canonical unit, min g, max g, default g]
const UNIT_TABLE = {
  bowl: ['bowl', 40, 400, 180], 'curry bowl': ['bowl', 40, 400, 180],
  'small bowl': ['small bowl', 50, 250, 120], small: ['small bowl', 50, 250, 120],
  'soup bowl': ['soup bowl', 150, 400, 220],
  plate: ['plate', 90, 500, 300], 'small plate': ['small plate', 60, 250, 180],
  dish: ['dish', 100, 500, 200], 'souffle dish': ['dish', 100, 500, 200], 'casserole dish': ['dish', 100, 500, 200],
  'small casserole dish': ['dish', 100, 400, 180], 'shallow dish': ['dish', 100, 500, 200],
  glass: ['glass', 150, 450, 250], 'tall glass': ['glass', 150, 450, 300], 'tall stemmed glass': ['glass', 100, 350, 200],
  'juice glass': ['glass', 100, 300, 200], 'sundae glass': ['glass', 100, 350, 200], 'half-pints': ['glass', 200, 350, 280],
  cup: ['cup', 50, 300, 150], 'tea cup': ['cup', 50, 300, 150], 'ice cream cup': ['cup', 50, 200, 80],
  'ice-cream cup': ['cup', 50, 200, 80], 'souffle cup': ['cup', 60, 250, 100],
  tablespoon: ['tablespoon', 8, 35, 15], teaspoon: ['teaspoon', 3, 8, 5],
  jar: ['tablespoon', 8, 35, 15], 'glass jar': ['tablespoon', 8, 35, 15], box: ['tablespoon', 8, 35, 15],
  slice: ['slice', 20, 120, 35], 'large slice': ['large slice', 40, 200, 80],
  triangle: ['triangle', 20, 100, 40], 'toasted triangle': ['triangle', 20, 100, 40],
  sandwich: ['sandwich', 45, 300, 130],
  biscuit: ['biscuit', 5, 40, 10], cookie: ['cookie', 8, 60, 15], cookies: ['cookie', 8, 60, 15],
  piece: ['piece', 15, 200, 50], 'large piece': ['large piece', 30, 300, 100],
  parantha: ['paratha', 40, 150, 80], paratha: ['paratha', 40, 150, 80], thepla: ['thepla', 25, 80, 45],
  roti: ['roti', 25, 70, 40], chapati: ['roti', 25, 70, 40], naan: ['naan', 60, 150, 90],
  poori: ['puri', 15, 50, 25], bhatura: ['bhatura', 40, 120, 70],
  egg: ['egg', 40, 180, 60], omelette: ['omelette', 50, 200, 90],
  cutlet: ['cutlet', 30, 120, 60], pancake: ['pancake', 30, 150, 70],
  ladoo: ['ladoo', 15, 60, 30], burfi: ['barfi', 15, 60, 30],
  vada: ['vada', 25, 120, 50], cheela: ['cheela', 40, 150, 80], dosa: ['dosa', 60, 200, 100],
  idli: ['idli', 25, 70, 40], uttapam: ['uttapam', 60, 200, 120], appam: ['appam', 40, 120, 70],
  samosa: ['samosa', 30, 150, 60], kachori: ['kachori', 30, 110, 50], pakora: ['pakora', 10, 80, 25],
  tart: ['tart', 30, 150, 60], pie: ['slice', 60, 200, 100], pastry: ['pastry', 40, 150, 70],
  patty: ['patty', 40, 150, 70], kebab: ['kebab', 20, 100, 40], kabab: ['kebab', 20, 100, 40],
  kofta: ['kofta', 15, 80, 30], roll: ['roll', 40, 250, 120], 'kaathi roll': ['roll', 80, 250, 150],
  'spring roll': ['roll', 30, 120, 60], 'bread roll': ['roll', 30, 120, 60], 'swiss roll': ['slice', 30, 100, 50],
  fillet: ['fillet', 60, 200, 120], 'chicken breast': ['piece', 80, 250, 150],
  portion: ['serving', 50, 500, 150], serving: ['serving', 50, 500, 150],
};
const GENERIC_UNIT = [null, 10, 400, 80];

// ── small helpers ───────────────────────────────────────────────────────────
const r2 = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n * 100) / 100);
const r3 = (n) => (n == null || Number.isNaN(n) ? null : Math.round(n * 1000) / 1000);
const num = (v) => {
  if (v == null || v === '') return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

function cellValue(v) {
  if (v == null) return null;
  if (typeof v === 'object') {
    if (v instanceof Date) return v;
    if ('result' in v) return v.result ?? null;
    // ExcelJS omits the cached result when a formula evaluates to 0 (e.g. carbs in ghee).
    if ('formula' in v || 'sharedFormula' in v) return 0;
    if (v.richText) return v.richText.map((t) => t.text).join('');
    if ('text' in v) return v.text;
    if ('error' in v) return null;
  }
  return v;
}

async function readSheet(file, sheetName) {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(file);
  const ws = sheetName ? wb.getWorksheet(sheetName) : wb.worksheets[0];
  if (!ws) throw new Error(`Sheet "${sheetName}" not found in ${file}`);
  const rows = [];
  let header = null;
  ws.eachRow({ includeEmpty: false }, (row) => {
    const values = row.values.slice(1).map(cellValue); // exceljs rows are 1-based
    if (!header) { header = values.map((h) => String(h).trim()); return; }
    const obj = {};
    header.forEach((h, i) => { obj[h] = values[i] ?? null; });
    rows.push(obj);
  });
  return rows;
}

const SMALL_WORDS = new Set(['and', 'with', 'of', 'in', 'on', 'ka', 'ki', 'ke', 'aur', 'kay', 'n', 'a', 'the', 'au', 'for']);
function titleCase(s) {
  return s.split(' ').map((w, i) => {
    if (!w) return w;
    const lw = w.toLowerCase();
    if (i > 0 && SMALL_WORDS.has(lw)) return lw;
    return w.replace(/[a-z]/i, (c) => c.toUpperCase());
  }).join(' ');
}

/** "Suji/Rava ladoo" → ["Suji ladoo", "Rava ladoo"] (max 8 variants). */
function expandSlashes(text) {
  const words = text.replace(/\s*\/\s*/g, '/').split(' ');
  let variants = [[]];
  for (const w of words) {
    const alts = w.includes('/') ? w.split('/').filter(Boolean) : [w];
    const next = [];
    for (const v of variants) for (const a of alts) next.push([...v, a]);
    variants = next.slice(0, 8);
  }
  return variants.map((v) => v.join(' ').trim());
}

const cleanText = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();

/** Split text into the part outside brackets and the top-level bracket groups (handles nesting). */
function splitBrackets(text) {
  let depth = 0;
  let base = '';
  let cur = '';
  const groups = [];
  for (const ch of text) {
    if (ch === '(') {
      if (depth > 0) cur += ' ';
      depth += 1;
    } else if (ch === ')') {
      if (depth === 0) continue;
      depth -= 1;
      if (depth === 0) { groups.push(cleanText(cur)); cur = ''; } else cur += ' ';
    } else if (depth > 0) cur += ch;
    else base += ch;
  }
  if (cur.trim()) groups.push(cleanText(cur));
  return { base: cleanText(base), groups: groups.filter(Boolean) };
}

// Bracket text made only of these words is a variant of the dish and stays in its name: "(toasted)", "(dry)".
const VARIANT_WORDS = new Set(['toasted', 'dry', 'wet', 'curry', 'gravy', 'baked', 'steamed', 'fried', 'medium',
  'thick', 'thin', 'salted', 'sweet', 'plain', 'boiled', 'raw', 'roasted', 'grilled', 'indian', 'style', 'whole',
  'stuffed', 'spicy', 'hot', 'cold', 'iced', 'large', 'small', 'mini', 'veg', 'non', 'restaurant', 'homemade',
  'instant', 'microwave', 'south', 'north', 'punjabi', 'bengali', 'gujarati', 'cooked', 'uncooked', 'mashed',
  'clear', 'creamy', 'light', 'rich', 'savoury', 'savory', 'simple', 'tadka', 'tempered', 'without', 'sugar']);
const isVariantGroup = (g) => g.split(/\s+/).length <= 3 && g.toLowerCase().split(/\s+/).every((w) => VARIANT_WORDS.has(w));

/** Split an Anuvaad name into a display name + aliases. */
function parseAnuvaadName(raw) {
  let encodingFixed = false;
  let name = cleanText(raw);
  if (name.includes('�')) { name = name.replace(/�/g, 'e'); encodingFixed = true; }
  const { base, groups } = splitBrackets(name);
  let english = base;
  let variantSuffix = '';
  const altNames = [];
  for (const g of groups) {
    if (/^(with|without|made|using|for|in)\b/i.test(g)) english = `${english} ${g}`; // "(with chicken)" is part of the name
    else if (isVariantGroup(g)) variantSuffix += ` (${g.toLowerCase()})`; // "(toasted)" is a variant
    else {
      // Another name, possibly with its own variant in brackets: "Pattagobhi rolls (curry)"
      const inner = splitBrackets(g);
      altNames.push(cleanText(`${inner.base} ${inner.groups.join(' ')}`));
    }
  }
  const englishVariants = expandSlashes(english);
  const altVariants = altNames.flatMap(expandSlashes);
  return {
    display: titleCase(`${englishVariants[0]}${variantSuffix}`),
    aliases: [
      ...englishVariants.map((v) => `${v}${variantSuffix}`),
      ...altVariants.map((v) => `${v}${variantSuffix}`),
      name.replace(/[()]/g, ' '),
    ],
    encodingFixed,
  };
}

function uniqLower(list, exclude) {
  const ex = (exclude || '').toLowerCase();
  const seen = new Set();
  const out = [];
  for (const a of list) {
    const v = cleanText(a).toLowerCase();
    if (!v || v === ex || seen.has(v)) continue;
    seen.add(v);
    out.push(v);
  }
  return out;
}

// kcalCheck, oilDominant, rangeCheck, servingUnits: services/foodDb/foodChecks.js (shared with the AI fallback)
const kcalCheck = (n) => checks.kcalCheck(n, KCAL_TOLERANCE);
const { oilDominant, rangeCheck, servingUnits } = checks;

// ── Anuvaad → food ──────────────────────────────────────────────────────────
function anuvaadNutrition(r) {
  return {
    calories: r2(num(r.energy_kcal)),
    protein: r2(num(r.protein_g)),
    carbs: r2(num(r.carb_g)),
    fats: r2(num(r.fat_g)),
    fiber: r2(num(r.fibre_g)),
    sugar: r2(num(r.freesugar_g)),
    sodium: r2(num(r.sodium_mg)),
    satFat: r2(num(r.sfa_mg) / 1000),
    cholesterol: r2(num(r.cholesterol_mg)),
    potassium: r2(num(r.potassium_mg)),
    calcium: r2(num(r.calcium_mg)),
    iron: r2(num(r.iron_mg)),
    vitaminC: r2(num(r.vitc_mg)),
  };
}

function anuvaadMicros(r) {
  const sum = (...vals) => (vals.every((v) => v == null) ? null : vals.reduce((s, v) => s + (v || 0), 0));
  return {
    mufa: r3(num(r.mufa_mg) / 1000),
    pufa: r3(num(r.pufa_mg) / 1000),
    phosphorus: r3(num(r.phosphorus_mg)),
    magnesium: r3(num(r.magnesium_mg)),
    zinc: r3(num(r.zinc_mg)),
    copper: r3(num(r.copper_mg)),
    selenium: r3(num(r.selenium_ug)),
    manganese: r3(num(r.manganese_mg)),
    chromium: r3(num(r.chromium_mg)),
    molybdenum: r3(num(r.molybdenum_mg)),
    vitaminA: r3(num(r.vita_ug)),
    vitaminE: r3(num(r.vite_mg)),
    vitaminD: r3(sum(num(r.vitd2_ug), num(r.vitd3_ug))),
    vitaminK: r3(sum(num(r.vitk1_ug), num(r.vitk2_ug))),
    folate: r3(num(r.folate_ug)),
    vitaminB1: r3(num(r.vitb1_mg)),
    vitaminB2: r3(num(r.vitb2_mg)),
    vitaminB3: r3(num(r.vitb3_mg)),
    vitaminB5: r3(num(r.vitb5_mg)),
    vitaminB6: r3(num(r.vitb6_mg)),
    biotin: r3(num(r.vitb7_ug)),
    carotenoids: r3(num(r.carotenoids_ug)),
  };
}

function anuvaadServing(r, category) {
  const rawUnit = cleanText(r.servings_unit).toLowerCase().replace(/�/g, 'e');
  const noUnit = category === 'chutney or condiment' ? UNIT_TABLE.tablespoon : ['serving', 50, 500, 100];
  const [canon, min, max, def] = UNIT_TABLE[rawUnit] || (rawUnit ? GENERIC_UNIT : noUnit);
  const unit = canon || rawUnit;
  const kcal100 = num(r.energy_kcal);
  const kcalServ = num(r.unit_serving_energy_kcal);
  const derived = kcal100 && kcalServ ? (kcalServ / kcal100) * 100 : null;
  const forcedCorrection = ['jar', 'glass jar', 'box'].includes(rawUnit);

  let grams;
  let flag = null;
  if (!forcedCorrection && derived != null && derived >= min && derived <= max) {
    grams = Math.round(derived);
  } else {
    grams = def;
    flag = derived == null ? 'serving_defaulted' : 'serving_corrected';
    if (!rawUnit) flag = 'serving_defaulted';
  }
  return { unit, grams, flag, rawUnit, derived: derived == null ? null : Math.round(derived) };
}

function buildAnuvaadFood(r) {
  const parsed = parseAnuvaadName(r.food_name);
  const nutritionPer100g = anuvaadNutrition(r);
  const category = C.categoryFromName(parsed.display);
  const p = C.padded(parsed.display);
  const cuisine = C.cuisineFromName(p);
  const allergens = C.allergensFromName(parsed.aliases.join(' '), cuisine);
  const dietType = C.dietTypeFromName(parsed.aliases.join(' '), category, allergens);
  const tags = C.tagsFromName(parsed.aliases.join(' '), category);
  const serving = anuvaadServing(r, category);
  const kc = kcalCheck(nutritionPer100g);
  const range = rangeCheck(nutritionPer100g, category);

  const flags = [];
  if (serving.flag) flags.push(serving.flag);
  if (!kc.ok) flags.push('macros_inconsistent');
  if (oilDominant(nutritionPer100g, category)) flags.push('oil_dominant');
  if (range.some((p) => !p.startsWith('oil-dominant'))) flags.push('out_of_range');
  if (parsed.encodingFixed) flags.push('name_encoding_fixed');

  return {
    _anu: { code: r.food_code, raw: cleanText(r.food_name), kcalCalc: kc.calc, range, serving, nameVariants: parsed.aliases },
    name: parsed.display,
    aliases: parsed.aliases,
    description: null,
    classification: {
      dietType,
      mealSlots: C.mealSlotsFor(category, p),
      course: C.COURSE_BY_CATEGORY[category] || 'main',
      category,
      cuisine,
      regions: [],
    },
    allergens: [...allergens],
    tags: [...tags],
    serving: { defaultUnit: serving.unit, defaultGrams: serving.grams, units: servingUnits(serving.unit, serving.grams) },
    nutritionPer100g,
    micronutrientsPer100g: anuvaadMicros(r),
    glycemicIndex: C.estimateGI(parsed.aliases.join(' '), category, nutritionPer100g.carbs),
    ingredients: [],
    source: { primary: 'anuvaad', anuvaadCode: r.food_code, anuvaadSource: r.primarysource || null, indDishId: null, aiModel: null, createdFromScanId: null },
    estimatedFields: ['classification', 'allergens', 'tags', 'glycemicIndex', ...(serving.flag ? ['serving'] : []), 'serving.units'],
    flags,
    usable: kc.ok && !range.length,
  };
}

// ── Independent schema → food ───────────────────────────────────────────────
const IND_UNIT = (unit, detail) => {
  const u = cleanText(unit).toLowerCase();
  const d = cleanText(detail).toLowerCase();
  if (u === 'number') return 'piece';
  if (u === 'spoon') return 'tablespoon';
  if (u === 'plate' || (u === 'serving' && d === 'plate')) return 'plate';
  if (u === 'bowl') return 'bowl';
  if (u === 'glass') return 'glass';
  return 'serving';
};

function buildIndFood(d, lines, aliasRows) {
  const grams = num(d.serving_weight_g);
  const per100 = (v) => (v == null || !grams ? null : r2((num(v) / grams) * 100));
  const nutritionPer100g = {
    calories: per100(d.calories_kcal),
    protein: per100(d.protein_g),
    carbs: per100(d.carbs_g),
    fats: per100(d.fat_g),
    fiber: per100(d.fibre_g),
    sugar: per100(d.sugars_g),
    sodium: per100(d.sodium_mg),
    satFat: per100(d.sat_fat_g),
    cholesterol: per100(d.cholesterol_mg),
    potassium: per100(d.potassium_mg),
    calcium: per100(d.calcium_mg),
    iron: per100(d.iron_mg),
    vitaminC: per100(d.vitamin_c_mg),
  };

  const regionTags = cleanText(d.region_tags).split(';').map((s) => s.trim()).filter(Boolean);
  let cuisine = 'indian';
  if (regionTags.some((t) => /^global$/i.test(t))) cuisine = 'global';
  if (regionTags.some((t) => /indo-chinese/i.test(t))) cuisine = 'indo_chinese';
  const regions = regionTags
    .filter((t) => !/^(india|global|indo-chinese)$/i.test(t))
    .map((t) => t.toLowerCase().replace(/\s+/g, '_'));

  const slotsRaw = cleanText(d.meal_slots).toLowerCase();
  const mealSlots = slotsRaw === 'any meal'
    ? ['breakfast', 'lunch', 'dinner', 'snack']
    : slotsRaw.split(',').map((s) => s.trim()).filter(Boolean);

  // "(1 piece)" / "(2 pieces)" is the serving, which lives in `serving`; keep the original only as an alias.
  const name = titleCase(cleanText(d.dish_name).replace(/\s*\(\s*\d+\s*pieces?\s*\)\s*/gi, ' ').trim());
  const allergens = C.allergensFromIngredients(lines);
  for (const a of C.allergensFromName(name, cuisine)) {
    // Name keywords only add allergens the recipe can't show (e.g. soy sauce in Indo-Chinese dishes).
    if (a === 'soy' && cuisine === 'indo_chinese') allergens.add(a);
  }
  const tags = C.tagsFromIngredients(lines);
  for (const t of C.methodTagsFromName(name)) tags.add(t);

  const unit = IND_UNIT(d.serving_unit, d.serving_unit_detail);
  const ingredients = lines
    .filter((l) => l.ingredient_id !== C.ING_WATER)
    .map((l) => ({
      ingredientId: l.ingredient_id,
      name: cleanText(l.ingredient_name),
      gramsPerServing: r2(num(l.grams_per_serving)),
      share: r3(num(l.share_of_serving)),
      nutritionPerServing: {
        calories: r2(num(l.calc_kcal)),
        protein: r2(num(l.calc_protein_g)),
        carbs: r2(num(l.calc_carbs_g)),
        fats: r2(num(l.calc_fat_g)),
        fiber: r2(num(l.calc_fibre_g)),
        sugar: r2(num(l.calc_sugars_g)),
        sodium: r2(num(l.calc_sodium_mg)),
      },
    }));

  const gi = num(d.glycemic_index_est) || null; // 0 = the sheet had no estimate (no carbs)
  const estimatedFields = ['allergens', 'tags', 'serving.units', 'micronutrientsPer100g'];
  const category = cleanText(d.dish_category);
  let glycemicIndex = gi == null ? null : Math.round(gi);
  if (glycemicIndex == null) {
    glycemicIndex = C.estimateGI(name, category, nutritionPer100g.carbs);
    estimatedFields.push('glycemicIndex');
  }

  const kc = kcalCheck(nutritionPer100g);
  const range = rangeCheck(nutritionPer100g, category);
  const flags = [];
  if (!kc.ok) flags.push('macros_inconsistent');
  if (oilDominant(nutritionPer100g, category)) flags.push('oil_dominant');
  if (range.some((p) => !p.startsWith('oil-dominant'))) flags.push('out_of_range');

  return {
    _ind: { dishId: d.dish_id, kcalCalc: kc.calc, range },
    name,
    aliases: [cleanText(d.dish_name), ...aliasRows.map((a) => a.alias)],
    description: cleanText(d.description) || null,
    classification: {
      dietType: cleanText(d.diet_type),
      mealSlots,
      course: cleanText(d.course),
      category,
      cuisine,
      regions,
    },
    allergens: [...allergens],
    tags: [...tags],
    serving: { defaultUnit: unit, defaultGrams: r2(grams), units: servingUnits(unit, grams) },
    nutritionPer100g,
    micronutrientsPer100g: null,
    glycemicIndex,
    ingredients,
    cookMinutes: num(d.approx_cook_min),
    prepMinutes: num(d.approx_prep_min),
    source: { primary: 'ind_schema', anuvaadCode: null, anuvaadSource: null, indDishId: d.dish_id, aiModel: null, createdFromScanId: null },
    estimatedFields,
    flags,
    usable: kc.ok && !range.length,
  };
}

/** Make ingredient per-serving values add up to the dish total (used when the dish total came from Anuvaad). */
function rescaleIngredients(food) {
  const keys = ['calories', 'protein', 'carbs', 'fats', 'fiber', 'sugar', 'sodium'];
  const g = food.serving.defaultGrams;
  for (const k of keys) {
    const dishVal = (food.nutritionPer100g[k] ?? 0) * g / 100;
    const sum = food.ingredients.reduce((s, i) => s + (i.nutritionPerServing[k] || 0), 0);
    if (!sum) continue;
    const f = dishVal / sum;
    for (const i of food.ingredients) {
      if (i.nutritionPerServing[k] != null) i.nutritionPerServing[k] = r2(i.nutritionPerServing[k] * f);
    }
  }
}

// ── main ────────────────────────────────────────────────────────────────────
async function main() {
  for (const f of [ANUVAAD_FILE, IND_FILE]) {
    if (!fs.existsSync(f)) throw new Error(`Source file not found: ${f}`);
  }
  console.log('Reading source files…');
  const [anuRows, dishes, recipeLines, aliasRows] = await Promise.all([
    readSheet(ANUVAAD_FILE),
    readSheet(IND_FILE, 'dishes'),
    readSheet(IND_FILE, 'recipe_lines'),
    readSheet(IND_FILE, 'aliases'),
  ]);

  const linesByDish = new Map();
  for (const l of recipeLines) {
    if (!linesByDish.has(l.dish_id)) linesByDish.set(l.dish_id, []);
    linesByDish.get(l.dish_id).push(l);
  }
  const aliasesByDish = new Map();
  for (const a of aliasRows) {
    if (!aliasesByDish.has(a.dish_id)) aliasesByDish.set(a.dish_id, []);
    aliasesByDish.get(a.dish_id).push(a);
  }

  const indFoods = dishes
    .filter((d) => d.dish_id)
    .sort((a, b) => String(a.dish_id).localeCompare(String(b.dish_id)))
    .map((d) => buildIndFood(d, linesByDish.get(d.dish_id) || [], aliasesByDish.get(d.dish_id) || []));
  const anuFoods = anuRows
    .filter((r) => r.food_code && r.food_name)
    .sort((a, b) => String(a.food_code).localeCompare(String(b.food_code)))
    .map(buildAnuvaadFood);
  console.log(`  independent dishes: ${indFoods.length}, Anuvaad foods: ${anuFoods.length}`);

  // ── merge duplicates across files (section 4.2) ───────────────────────────
  console.log('Matching duplicates across the two files…');
  const indIndex = indFoods.map((f) => ({
    food: f,
    key: C.proteinKey(f.aliases.join(' ')),
    variants: [...new Set(f.aliases.map(normalize).filter(Boolean))],
  }));
  const tokenToInd = new Map();
  indIndex.forEach((entry, i) => {
    for (const v of entry.variants) for (const t of v.split(' ')) {
      if (!tokenToInd.has(t)) tokenToInd.set(t, new Set());
      tokenToInd.get(t).add(i);
    }
  });

  const candidates = []; // { anu, indIdx, score, matchedAnu, matchedInd }
  for (const anu of anuFoods) {
    const variants = [...new Set(anu._anu.nameVariants.map(normalize).filter(Boolean))];
    const key = C.proteinKey(anu._anu.nameVariants.join(' '));
    const pool = new Set();
    for (const v of variants) for (const t of v.split(' ')) for (const i of tokenToInd.get(t) || []) pool.add(i);
    let best = null;
    for (const i of pool) {
      const entry = indIndex[i];
      if (entry.key !== key) continue;
      for (const av of variants) for (const iv of entry.variants) {
        const s = similarity(av, iv);
        if (s < MERGE_MIN_SIMILARITY || (best && s <= best.score)) continue;
        if (tokenOverlap(av, iv) < MERGE_MIN_WORD_OVERLAP) continue;
        best = { anu, indIdx: i, score: s, matchedAnu: av, matchedInd: iv };
      }
    }
    if (best && best.score >= MERGE_MIN_SIMILARITY) candidates.push(best);
  }
  // Each independent dish takes its highest-scoring Anuvaad match; the rest stay separate but are flagged.
  candidates.sort((a, b) => b.score - a.score || a.anu._anu.code.localeCompare(b.anu._anu.code));
  const takenInd = new Set();
  const merges = [];
  const possibleDuplicates = [];
  for (const c of candidates) {
    if (takenInd.has(c.indIdx)) {
      c.anu.flags.push('possible_duplicate');
      possibleDuplicates.push({ anuvaad: c.anu._anu.raw, similarTo: indIndex[c.indIdx].food.name, score: r3(c.score) });
      continue;
    }
    takenInd.add(c.indIdx);
    c.anu._mergedInto = indIndex[c.indIdx].food;
    merges.push(c);
  }

  for (const m of merges) {
    const ind = m.anu._mergedInto;
    const anu = m.anu;
    ind.source.primary = 'merged';
    ind.source.anuvaadCode = anu.source.anuvaadCode;
    ind.source.anuvaadSource = anu.source.anuvaadSource;
    ind.aliases.push(...anu.aliases);
    ind.micronutrientsPer100g = anu.micronutrientsPer100g;
    ind.estimatedFields = ind.estimatedFields.filter((f) => f !== 'micronutrientsPer100g');
    ind.flags.push('merged_duplicate');
    ind._mergeInfo = { anuvaad: anu._anu.raw, score: r3(m.score), macrosFrom: 'ind_schema' };
    if (anu.usable) {
      // Anuvaad per-100 g values come from published recipes; prefer them when they pass the checks.
      ind.nutritionPer100g = anu.nutritionPer100g;
      ind._mergeInfo.macrosFrom = 'anuvaad';
      if (ind.ingredients.length) { rescaleIngredients(ind); ind.flags.push('ingredients_rescaled'); }
      const giMissing = ind.estimatedFields.includes('glycemicIndex');
      if (giMissing) ind.glycemicIndex = C.estimateGI(ind.name, ind.classification.category, ind.nutritionPer100g.carbs);
    }
  }

  // Duplicate names inside Anuvaad itself.
  const seenAnu = new Map();
  for (const a of anuFoods) {
    if (a._mergedInto) continue;
    const k = normalize(a.name);
    if (seenAnu.has(k)) {
      a.flags.push('possible_duplicate');
      possibleDuplicates.push({ anuvaad: a._anu.raw, similarTo: seenAnu.get(k), score: 1 });
    } else seenAnu.set(k, a._anu.raw);
  }

  // ── assemble final documents ──────────────────────────────────────────────
  const finalFoods = [...indFoods, ...anuFoods.filter((a) => !a._mergedInto)];
  let seq = 0;
  const docs = finalFoods.map((f) => {
    seq += 1;
    const foodId = `THF-${String(seq).padStart(5, '0')}`;
    f._foodId = foodId;
    if ((f.nutritionPer100g.sugar ?? 0) >= 15 && !f.tags.includes('high_sugar')) f.tags.push('high_sugar');
    const aliases = uniqLower(f.aliases, f.name);
    const searchText = [...new Set(tokens([f.name, ...aliases].join(' ')))].join(' ');
    const isActive = f.usable;
    return {
      foodId,
      name: f.name,
      aliases,
      searchText,
      description: f.description,
      classification: f.classification,
      allergens: [...new Set(f.allergens)].sort(),
      tags: [...new Set(f.tags)].sort(),
      serving: f.serving,
      nutritionPer100g: f.nutritionPer100g,
      micronutrientsPer100g: f.micronutrientsPer100g,
      glycemicIndex: f.glycemicIndex,
      ingredients: f.ingredients,
      ...(f.cookMinutes != null ? { cookMinutes: f.cookMinutes, prepMinutes: f.prepMinutes } : {}),
      source: f.source,
      dataQuality: {
        status: 'estimated',
        estimatedFields: [...new Set(f.estimatedFields)],
        flags: [...new Set(f.flags)],
        checksPassed: f.usable,
        reviewedBy: null,
        reviewedAt: null,
      },
      stats: { hitCount: 0, lastMatchedAt: null },
      isActive,
    };
  });

  // ── report ────────────────────────────────────────────────────────────────
  const count = (pred) => docs.filter(pred).length;
  const tally = (fn) => docs.reduce((acc, d) => { for (const k of [].concat(fn(d))) acc[k] = (acc[k] || 0) + 1; return acc; }, {});
  const disabled = finalFoods.filter((f) => !f.usable).map((f) => ({
    foodId: f._foodId,
    name: f.name,
    source: f.source.anuvaadCode || f.source.indDishId,
    reason: [
      ...(f.flags.includes('macros_inconsistent') ? [`kcal ${f.nutritionPer100g.calories} vs macros ${(f._anu || f._ind).kcalCalc}`] : []),
      ...((f._anu || f._ind).range || []),
    ].join('; '),
    // Closest active independent-schema dish, so an admin can see whether the food is still covered.
    closestActive: (() => {
      let best = null;
      for (const i of indFoods) {
        if (!i.usable) continue;
        const s = similarity(f.name, i.name);
        if (!best || s > best.score) best = { name: i.name, foodId: i._foodId, score: r3(s) };
      }
      return best && best.score >= 0.8 ? best : null;
    })(),
  }));
  const servingFixes = anuFoods
    .filter((a) => !a._mergedInto && a._anu.serving.flag)
    .map((a) => ({ foodId: a._foodId, name: a.name, unit: a._anu.serving.rawUnit || '(none)', derivedGrams: a._anu.serving.derived, usedGrams: a._anu.serving.grams, flag: a._anu.serving.flag }));
  const mergedNotUsed = merges.filter((m) => !m.anu.usable).map((m) => ({ name: m.anu._mergedInto.name, anuvaad: m.anu._anu.raw }));

  const report = {
    generatedAt: new Date().toISOString(),
    sources: { anuvaad: path.basename(ANUVAAD_FILE), independent: path.basename(IND_FILE) },
    counts: {
      sourceIndependentDishes: indFoods.length,
      sourceAnuvaadFoods: anuFoods.length,
      merged: merges.length,
      totalFoods: docs.length,
      active: count((d) => d.isActive),
      disabled: count((d) => !d.isActive),
      bySource: tally((d) => d.source.primary),
      byDietType: tally((d) => d.classification.dietType),
      byCategory: tally((d) => d.classification.category),
      byCuisine: tally((d) => d.classification.cuisine),
      byAllergen: tally((d) => d.allergens),
      byTag: tally((d) => d.tags),
      byFlag: tally((d) => d.dataQuality.flags),
      withGlycemicIndex: count((d) => d.glycemicIndex != null),
      withIngredients: count((d) => d.ingredients.length > 0),
      withMicronutrients: count((d) => d.micronutrientsPer100g != null),
    },
    disabled,
    merges: merges.map((m) => ({
      foodId: m.anu._mergedInto._foodId,
      name: m.anu._mergedInto.name,
      anuvaad: m.anu._anu.raw,
      score: r3(m.score),
      macrosFrom: m.anu._mergedInto._mergeInfo.macrosFrom,
    })),
    mergedButAnuvaadValuesRejected: mergedNotUsed,
    possibleDuplicates,
    servingFixes,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const seedPath = path.join(OUT_DIR, 'foods.seed.json');
  const reportPath = path.join(OUT_DIR, 'foods.build-report.json');
  fs.writeFileSync(seedPath, JSON.stringify(docs, null, 2));
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2));

  console.log('\nDone.');
  console.log(`  foods:     ${docs.length} (active ${report.counts.active}, disabled ${report.counts.disabled})`);
  console.log(`  merged:    ${merges.length} Anuvaad foods merged into independent dishes`);
  console.log(`  by source: ${JSON.stringify(report.counts.bySource)}`);
  console.log(`  flags:     ${JSON.stringify(report.counts.byFlag)}`);
  console.log(`  seed:      ${path.relative(SERVER_DIR, seedPath)}`);
  console.log(`  report:    ${path.relative(SERVER_DIR, reportPath)}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
