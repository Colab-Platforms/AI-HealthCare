// Deterministic check that a generated meal respects the user's diet type.
//
// A prompt rule ("never include eggs") is a request to the model, not a
// guarantee. This guard runs on the output and rejects any meal whose name,
// description or ingredients contain a term forbidden for that diet.
//
// Matching is on whole words only, so 'egg' does not match 'eggplant' and
// 'fish' does not match 'fishcake' from an unrelated word. Known exceptions
// are listed explicitly below so a false positive can be fixed in one place.

const FORBIDDEN = {
  vegetarian: {
    meat: ['chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'keema', 'kheema', 'meat', 'turkey', 'duck', 'prawn', 'prawns', 'shrimp', 'crab', 'lobster', 'fish', 'tuna', 'salmon', 'anchovy', 'anchovies'],
    egg: ['egg', 'eggs', 'omelette', 'omelet', 'anda', 'egg bhurji'],
  },
  eggetarian: {
    meat: ['chicken', 'mutton', 'lamb', 'goat', 'beef', 'pork', 'bacon', 'ham', 'sausage', 'keema', 'kheema', 'meat', 'turkey', 'duck', 'prawn', 'prawns', 'shrimp', 'crab', 'lobster', 'fish', 'tuna', 'salmon', 'anchovy', 'anchovies'],
  },
  vegan: {
    meat: null, // filled below: vegan forbids everything vegetarian forbids
    egg: null,
    dairy: ['milk', 'paneer', 'ghee', 'curd', 'dahi', 'yogurt', 'yoghurt', 'butter', 'cheese', 'cream', 'khoya', 'mawa', 'honey'],
  },
};
FORBIDDEN.vegan.meat = FORBIDDEN.vegetarian.meat;
FORBIDDEN.vegan.egg = FORBIDDEN.vegetarian.egg;

// Words that contain a forbidden term but are not one. Checked before flagging.
const ALLOWED_PHRASES = [
  'eggplant', 'egg plant', 'eggless', 'egg-free', 'egg free',
  'coconut milk', 'peanut butter', 'butter beans', 'buttermilk', 'oat milk',
  'almond milk', 'soy milk', 'soya milk', 'coconut cream', 'cream of wheat',
  'nutmeg', 'hamper', 'shamrock',
];

function escapeRe(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function stripAllowed(text) {
  let out = text;
  for (const phrase of ALLOWED_PHRASES) {
    out = out.replace(new RegExp(`\\b${escapeRe(phrase)}\\b`, 'gi'), ' ');
  }
  return out;
}

/**
 * @param {string} diet - normalized diet type
 * @param {Object} meal - generated meal object (name, description, ingredients, foodItems)
 * @returns {{ ok: boolean, hits: string[] }}
 */
function checkMealForDiet(diet, meal) {
  const rules = FORBIDDEN[diet];
  if (!rules || !meal) return { ok: true, hits: [] };

  const text = stripAllowed([
    meal.name,
    meal.description,
    Array.isArray(meal.ingredients) ? meal.ingredients.join(' ') : meal.ingredients,
    Array.isArray(meal.foodItems) ? meal.foodItems.map((f) => f?.name).join(' ') : '',
  ].filter(Boolean).join(' ').toLowerCase());

  const hits = [];
  for (const group of Object.values(rules)) {
    if (!group) continue;
    for (const term of group) {
      if (new RegExp(`\\b${escapeRe(term)}\\b`).test(text)) hits.push(term);
    }
  }
  return { ok: hits.length === 0, hits };
}

module.exports = { checkMealForDiet };
