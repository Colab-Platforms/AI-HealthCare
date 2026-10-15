// Age/gender-aware daily nutrient targets for the Diet Quality Score's
// Adequacy (Mean Adequacy Ratio) and Moderation components. Every value below
// is sourced from a real, published reference — see the comment on each
// function. Nothing here is invented; where research showed a value is
// age/gender-dependent, that dependency is implemented, not flattened to one
// number for convenience.

// ---- Adequacy targets (want to MEET or EXCEED these) ----

// NIH ODS: RDA 900mcg RAE (male) / 700mcg RAE (female), same across adult ages.
function vitaminATargetMcg(gender) {
  return gender === 'female' ? 700 : 900;
}

// NIH ODS: RDA 90mg (male) / 75mg (female), same across adult ages.
// (Smokers need +35mg per NIH ODS; not modeled here — no smoking-status field exists yet.)
function vitaminCTargetMg(gender) {
  return gender === 'female' ? 75 : 90;
}

// NIH ODS: RDA 15mcg (600 IU) for ages 19-70, rising to 20mcg (800 IU) at 71+.
// Same for both sexes — this one varies by AGE only, not gender.
function vitaminDTargetMcg(age) {
  return age >= 71 ? 20 : 15;
}

// NIH ODS: RDA 2.4mcg for all adults — the one nutrient here with NO
// age or gender variation among adults.
function vitaminB12TargetMcg() {
  return 2.4;
}

// NIH ODS: the largest gender gap of any nutrient here — pre-menopausal women
// need more than double a man's requirement due to menstrual blood loss.
// Men (19+): 8mg. Women 19-50: 18mg. Women 51+: 8mg (post-menopause assumed).
function ironTargetMg(gender, age) {
  if (gender === 'female' && age < 51) return 18;
  return 8;
}

// NIH ODS: 1000mg for ages 19-50 (both sexes) and men 51-70; rises to 1200mg
// for women 51+ and everyone 71+ (accelerated bone loss post-menopause / with age).
function calciumTargetMg(gender, age) {
  if (gender === 'female' && age >= 51) return 1200;
  if (age >= 71) return 1200;
  return 1000;
}

// National Academies (2019 revision — NOT the older, now-outdated 4700mg FDA
// food-label figure still printed on packaging): Men 3400mg, Women 2600mg.
function potassiumTargetMg(gender) {
  return gender === 'female' ? 2600 : 3400;
}

// NIH ODS: varies by BOTH age and gender. 19-30: M400/F310. 31+: M420/F320.
function magnesiumTargetMg(gender, age) {
  if (age <= 30) return gender === 'female' ? 310 : 400;
  return gender === 'female' ? 320 : 420;
}

// NIH ODS: only ALA has an established Adequate Intake (EPA/DHA do not).
// Men 1.6g, Women 1.1g — no established age-banding found in the DRI.
function omega3TargetG(gender) {
  return gender === 'female' ? 1.1 : 1.6;
}

// USDA/WHO convention already used elsewhere in this codebase (HealthGoal.js
// macro calc): 14g fiber per 1000 kcal of the user's own calorie target.
function fiberTargetG(calorieGoal) {
  const calories = calorieGoal > 0 ? calorieGoal : 2000; // sane fallback
  return Math.round((calories * 14) / 1000);
}

// ---- Moderation caps (want to STAY UNDER these) ----

// AHA: saturated fat should be 5-6% of total daily calories — a percentage
// of the user's OWN calorie goal, not a flat gram number for everyone.
// 9 kcal per gram of fat is the standard Atwater conversion factor.
function saturatedFatCapG(calorieGoal) {
  const calories = calorieGoal > 0 ? calorieGoal : 2000;
  return Math.round((calories * 0.06) / 9);
}

// WHO: free/added sugar should be under 10% of total daily calories (with a
// further "under 5%" aspirational target) — 4 kcal per gram of sugar.
// Using the 10% ceiling here since that is WHO's firm recommendation; the 5%
// figure is explicitly labeled "additional benefit," not the primary cap.
function addedSugarCapG(calorieGoal) {
  const calories = calorieGoal > 0 ? calorieGoal : 2000;
  return Math.round((calories * 0.10) / 4);
}

// AHA/FDA: 2300mg/day sodium ceiling for the general adult population.
function sodiumCapMg() {
  return 2300;
}

// National Academies (Institute of Medicine) Dietary Reference Intakes (2005) —
// Acceptable Macronutrient Distribution Range. Same for all adults, not
// age/gender-dependent, unlike the targets above. Expressed as % of total
// daily calories, not grams, because the "right" gram amount depends on how
// much a person eats overall — the range is about balance, not quantity.
// A revision is under active review (National Academies "Rethinking the
// AMDR", 2024-25 letter report) but these are still the current published
// standard used across US Dietary Guidelines and clinical practice.
// Atwater conversion — same factor dietQualityScoreService.js and the diet
// AI prompts already assume; duplicated here (not imported) since this file
// has no other dependency on that service and the constant never changes.
const PROTEIN_KCAL_PER_G = 4;

const AMDR_RANGES = {
  protein: [10, 35],
  carbs: [45, 65],
  fat: [20, 35],
};

// Protein g/kg-bodyweight/day multiplier ranges, by goal — published sports-
// nutrition guidance, not invented. Used to shift the protein AMDR window
// away from the fixed 10-35% DRI range for the two goals that have a
// specific, widely-cited multiplier:
//   muscle_gain: International Society of Sports Nutrition position stand
//     on protein and exercise (Jäger et al., 2017) — 1.6-2.2 g/kg/day.
//   weight_loss: Helms, Aragon & Fitschen (2014), "Evidence-based
//     recommendations for natural bodybuilding contest preparation" —
//     1.6-2.4 g/kg/day to preserve lean mass in a calorie deficit. Their
//     reviewed range runs higher still for very lean/aggressive deficits;
//     2.4 is used as the defensible, commonly-cited figure rather than that
//     extreme upper edge.
// Every other goalType (maintain, weight_gain, general_health, disease
// management, ...) has no similarly specific multiplier in the literature,
// so it keeps the fixed DRI range below unchanged — this is a deliberate
// "don't guess" default, not an oversight.
const GOAL_PROTEIN_G_PER_KG = {
  muscle_gain: [1.6, 2.2],
  weight_loss: [1.6, 2.4],
};

// A personalized window can never fall outside these percentages, however
// extreme the inputs — keeps a bad weight/calorie value from ever producing
// a nonsensical range instead of silently falling back to the fixed one.
const PERSONALIZED_PROTEIN_PCT_BOUNDS = [10, 45];

/**
 * @param {Object} [opts]
 * @param {string} [opts.goalType] - HealthGoal.goalType
 * @param {number} [opts.weightKg] - current bodyweight
 * @param {number} [opts.calorieGoal] - the calorie figure the resulting %
 *   window will be interpreted against. dietQualityScoreService.js passes
 *   the day's own total calories here (not the user's calorie goal), to
 *   stay on the same basis AMDR is actually scored on — see its call site.
 */
function getAmdrRanges({ goalType, weightKg, calorieGoal } = {}) {
  const multipliers = GOAL_PROTEIN_G_PER_KG[goalType];
  const hasPersonalInputs = multipliers && Number(weightKg) > 0 && Number(calorieGoal) > 0;

  // No goal-specific multiplier, or missing the inputs to apply one — the
  // same "fall back to the safe default rather than guess" pattern used
  // throughout this file. A user with no weight logged yet, or on a goal
  // with no published multiplier, is scored on the standard DRI range,
  // exactly as before this change.
  if (!hasPersonalInputs) return AMDR_RANGES;

  const [floor, ceiling] = PERSONALIZED_PROTEIN_PCT_BOUNDS;
  const clamp = (pct, lo, hi) => Math.max(lo, Math.min(hi, pct));
  const pctFromGPerKg = (gPerKg) => (gPerKg * weightKg * PROTEIN_KCAL_PER_G / calorieGoal) * 100;

  const [gPerKgMin, gPerKgMax] = multipliers;
  // min is clamped one point short of the ceiling (not the ceiling itself),
  // so "max(..., min + 1)" below always has room to land AT OR UNDER the
  // real ceiling — clamping both independently to the same [floor, ceiling]
  // could otherwise push min+1 one point past it on extreme inputs (a very
  // low calorie goal relative to bodyweight), which an earlier version of
  // this did.
  const proteinMin = Math.round(clamp(pctFromGPerKg(gPerKgMin), floor, ceiling - 1));
  const proteinMaxRaw = Math.round(clamp(pctFromGPerKg(gPerKgMax), floor + 1, ceiling));
  // Guards the case both raw values clamp to (near-)equal numbers — amdrNar's
  // rangeWidth must never be 0, or every score for this nutrient is 0 by
  // construction regardless of what the user actually ate.
  const proteinMax = Math.max(proteinMaxRaw, proteinMin + 1);

  return { ...AMDR_RANGES, protein: [proteinMin, proteinMax] };
}

function normalizeGender(gender) {
  return gender === 'female' ? 'female' : 'male'; // binary DRI tables only exist for male/female; unset defaults to male (the less restrictive of the two for most of these targets)
}

function getAdequacyTargets({ age, gender, calorieGoal }) {
  const g = normalizeGender(gender);
  const a = Number(age) > 0 ? Number(age) : 30; // sane fallback
  return {
    fiber: fiberTargetG(calorieGoal),
    vitaminA: vitaminATargetMcg(g),
    vitaminC: vitaminCTargetMg(g),
    vitaminD: vitaminDTargetMcg(a),
    vitaminB12: vitaminB12TargetMcg(),
    iron: ironTargetMg(g, a),
    calcium: calciumTargetMg(g, a),
    potassium: potassiumTargetMg(g),
    magnesium: magnesiumTargetMg(g, a),
    omega3: omega3TargetG(g),
  };
}

function getModerationCaps({ calorieGoal }) {
  return {
    addedSugar: addedSugarCapG(calorieGoal),
    sodium: sodiumCapMg(),
    saturatedFat: saturatedFatCapG(calorieGoal),
  };
}

module.exports = { getAdequacyTargets, getModerationCaps, getAmdrRanges };
