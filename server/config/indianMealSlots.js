/**
 * What a breakfast, a lunch and a dinner actually are in an Indian household.
 *
 * Why this exists: the diet prompt used to say only "breakfast + lunch + dinner
 * must total the daily target". With no snack slot, three meals have to carry the
 * whole day, and an unconstrained model fills a ~650 kcal breakfast with the
 * first heavy thing that fits the number — biryani. Nothing in the prompt said a
 * breakfast is a light morning tiffin, so nothing stopped it.
 *
 * Two things live here, both pure data/functions so they can be tested without
 * the model:
 *   1. SLOT_SHARES / SLOT_BOUNDS — how the day's calories are split, and how far
 *      a single slot may drift before it is "wrong for the time of day".
 *   2. Per-slot guidance text and the term lists mealGuard uses to enforce it.
 */

// Real Indian routine: a modest tiffin, the main meal at lunch, a lighter
// dinner. Sums to exactly 1 so the budgets always add back to the daily target.
const SLOT_SHARES = { breakfast: 0.28, lunch: 0.40, dinner: 0.32 };

// A slot outside its bounds is flagged even when its name looks fine: a 900 kcal
// "breakfast" is a lunch no matter what it is called.
const SLOT_BOUNDS = {
  breakfast: [0.15, 0.36],
  lunch: [0.30, 0.48],
  dinner: [0.22, 0.40],
};

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner'];

/**
 * Split a daily target into per-slot budgets that sum EXACTLY to the target.
 * Dinner takes the rounding remainder so the three never drift from the total.
 *
 * @param {number} dailyCalories
 * @returns {{breakfast: number, lunch: number, dinner: number}}
 */
function buildSlotBudget(dailyCalories) {
  const total = Math.max(0, Math.round(Number(dailyCalories) || 0));
  const breakfast = Math.round(total * SLOT_SHARES.breakfast);
  const lunch = Math.round(total * SLOT_SHARES.lunch);
  return { breakfast, lunch, dinner: total - breakfast - lunch };
}

/** Allowed calorie range for one slot, as absolute kcal. */
function slotCalorieRange(slot, dailyCalories) {
  const [lo, hi] = SLOT_BOUNDS[slot] || [0, 1];
  return { min: Math.round(dailyCalories * lo), max: Math.round(dailyCalories * hi) };
}

const SLOT_GUIDANCE = {
  breakfast:
    'BREAKFAST = a light-to-moderate morning tiffin, the way an Indian home actually eats it: poha, upma, idli/dosa/uttapam with sambar and chutney, paratha or thepla with curd, besan or moong dal chilla, dalia, ragi dosa, sprouts, vegetable sandwich, or (only if eggs are allowed) egg bhurji / omelette / boiled eggs with roti or toast. ' +
    'NEVER for breakfast: biryani, pulao, fried rice, rice-with-curry plates, thali, dal-chawal, heavy meat or fish curries, dal makhani, desserts as the main item.',
  lunch:
    'LUNCH = the main meal of the day: roti and/or rice with dal and a seasonal sabzi, plus curd or salad; or khichdi, rajma-chawal, chole, kadhi-chawal, sambar-rice; and (only if the diet allows) chicken, egg or fish curry with roti or rice. ' +
    'Biryani/pulao only occasionally — at most once in the 7 days, and only if the calorie budget allows. NEVER for lunch: cornflakes, muesli, toast, pancakes, smoothies.',
  dinner:
    'DINNER = lighter than lunch, a simple home dinner: roti with sabzi and dal, dal-khichdi, a light curry with roti, moong chilla, paneer or egg bhurji with roti, dalia khichdi, tandoori/grilled protein with roti and salad. ' +
    'No heavy fried items, no sweets as the main item, and not heavier than that day\'s lunch.',
};

// Dishes that mark a slot as wrong for the time of day. Whole-word, lowercase.
// Soft rules: a hit sends the dish back for replacement; a regional exception
// that still comes back after repair is accepted rather than failing the plan.
const SLOT_FORBIDDEN_TERMS = {
  breakfast: [
    'biryani', 'biriyani', 'pulao', 'pulav', 'fried rice', 'jeera rice', 'dal chawal', 'dal rice',
    'rajma chawal', 'rajma rice', 'curry rice', 'rice bowl', 'thali', 'curd rice',
    'butter chicken', 'chicken curry', 'mutton curry', 'fish curry', 'chicken tikka', 'kebab',
    'dal makhani', 'kadhi chawal', 'khichdi',
  ],
  lunch: ['cornflakes', 'corn flakes', 'muesli', 'toast', 'pancake', 'pancakes', 'smoothie', 'cereal', 'overnight oats'],
  dinner: ['cornflakes', 'corn flakes', 'muesli', 'pancake', 'pancakes', 'smoothie', 'cereal', 'halwa', 'jalebi', 'gulab jamun'],
};

// Phrases that contain a forbidden term but are a normal dish for that slot.
const SLOT_ALLOWED_PHRASES = [
  'sabudana khichdi', 'bisi bele bath', 'sooji khichdi', 'dalia khichdi', 'vegetable dalia khichdi',
];

// Not Indian home cooking. Flagged in any slot — the feature is "genuine Indian
// routine", and a salmon/quinoa/avocado-toast plan is the opposite of that.
const FOREIGN_TERMS = [
  'pasta', 'pizza', 'burger', 'avocado', 'quinoa', 'salmon', 'steak', 'tacos', 'taco', 'sushi',
  'lasagna', 'risotto', 'hummus', 'falafel', 'kale', 'chia pudding', 'smoothie bowl', 'acai',
  'protein pancakes', 'french toast', 'granola', 'parfait', 'bagel', 'wrap bowl', 'buddha bowl',
  'poke bowl', 'noodles', 'hakka',
];

function buildSlotBudgetInstructions(dailyCalories) {
  const b = buildSlotBudget(dailyCalories);
  return (
    `CALORIE BUDGET PER SLOT (every day): breakfast ≈ ${b.breakfast} kcal, lunch ≈ ${b.lunch} kcal, dinner ≈ ${b.dinner} kcal ` +
    `(each within ±8%). These three add up to ${dailyCalories} kcal. Fill the budget with a realistic Indian portion, not by choosing a heavier dish.`
  );
}

module.exports = {
  SLOT_SHARES,
  SLOT_BOUNDS,
  MEAL_TYPES,
  SLOT_GUIDANCE,
  SLOT_FORBIDDEN_TERMS,
  SLOT_ALLOWED_PHRASES,
  FOREIGN_TERMS,
  buildSlotBudget,
  slotCalorieRange,
  buildSlotBudgetInstructions,
};
