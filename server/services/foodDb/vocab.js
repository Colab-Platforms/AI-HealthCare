/**
 * Controlled vocabulary for the `foods` collection.
 * See docs/FOOD_DB_FLOW.md section 5.2.
 */

const DIET_TYPES = ['vegan', 'vegetarian', 'eggetarian', 'non_vegetarian'];
const MEAL_SLOTS = ['breakfast', 'lunch', 'dinner', 'snack'];
const COURSES = ['main', 'side', 'snack', 'dessert', 'drink', 'condiment'];
const CATEGORIES = [
  'vegetable or paneer dish', 'one-dish meal or breakfast item', 'lentil or legume dish',
  'snack', 'meat or fish curry', 'meat or fish (dry)', 'egg dish', 'dessert', 'flatbread',
  'beverage', 'raita or curd side', 'soup', 'salad', 'chutney or condiment', 'plain rice',
  'bakery', 'other',
];
const CUISINES = ['indian', 'indo_chinese', 'global'];

const ALLERGENS = ['milk', 'egg', 'peanut', 'tree_nuts', 'gluten', 'soy', 'fish', 'shellfish', 'sesame', 'mustard'];

const TAGS = [
  'fried', 'deep_fried', 'ghee_heavy', 'spicy', 'refined_carb', 'rice_based', 'red_meat',
  'processed', 'high_sugar', 'goitrogen', 'contains_onion_garlic', 'contains_root_veg',
];

const SOURCES = ['anuvaad', 'ind_schema', 'merged', 'ai', 'manual'];
const DATA_STATUS = ['verified', 'estimated', 'ai_pending', 'rejected'];
const DATA_FLAGS = [
  'macros_inconsistent', 'oil_dominant', 'serving_defaulted', 'serving_corrected', 'out_of_range',
  'merged_duplicate', 'possible_duplicate', 'ingredients_rescaled', 'name_encoding_fixed',
];

// Units for every numeric field stored per 100 g.
const NUTRIENT_UNITS = {
  nutritionPer100g: {
    calories: 'kcal', protein: 'g', carbs: 'g', fats: 'g', fiber: 'g', sugar: 'g',
    sodium: 'mg', satFat: 'g', cholesterol: 'mg', potassium: 'mg', calcium: 'mg',
    iron: 'mg', vitaminC: 'mg',
  },
  micronutrientsPer100g: {
    mufa: 'g', pufa: 'g', phosphorus: 'mg', magnesium: 'mg', zinc: 'mg', copper: 'mg',
    selenium: 'ug', manganese: 'mg', chromium: 'mg', molybdenum: 'mg', vitaminA: 'ug',
    vitaminE: 'mg', vitaminD: 'ug', vitaminK: 'ug', folate: 'ug', vitaminB1: 'mg',
    vitaminB2: 'mg', vitaminB3: 'mg', vitaminB5: 'mg', vitaminB6: 'mg', biotin: 'ug',
    carotenoids: 'ug',
  },
};

/**
 * Free text a user may type in allergies / dietaryRestrictions → allergen codes.
 * Matched case-insensitively as whole words. Used by the warnings engine (section 9.2).
 */
const ALLERGEN_SYNONYMS = [
  { allergens: ['milk'], words: ['milk', 'dairy', 'lactose', 'curd', 'dahi', 'paneer', 'cheese', 'ghee', 'butter', 'cream', 'whey', 'casein', 'khoa', 'mawa'] },
  { allergens: ['egg'], words: ['egg', 'eggs', 'anda', 'albumin'] },
  { allergens: ['peanut'], words: ['peanut', 'peanuts', 'groundnut', 'groundnuts', 'moongfali', 'mungfali', 'moongphali'] },
  { allergens: ['peanut', 'tree_nuts'], words: ['nut', 'nuts'] },
  { allergens: ['tree_nuts'], words: ['almond', 'almonds', 'badam', 'cashew', 'cashews', 'kaju', 'walnut', 'walnuts', 'akhrot', 'pistachio', 'pistachios', 'pista', 'hazelnut', 'pecan', 'tree nut', 'tree nuts'] },
  { allergens: ['gluten'], words: ['gluten', 'wheat', 'atta', 'maida', 'celiac', 'coeliac', 'barley', 'rye', 'semolina', 'suji', 'sooji'] },
  { allergens: ['soy'], words: ['soy', 'soya', 'tofu', 'soybean', 'soybeans'] },
  { allergens: ['fish'], words: ['fish', 'machli', 'machhli', 'seafood'] },
  { allergens: ['shellfish'], words: ['shellfish', 'prawn', 'prawns', 'shrimp', 'shrimps', 'jhinga', 'crab', 'lobster', 'seafood'] },
  { allergens: ['sesame'], words: ['sesame', 'til', 'gingelly'] },
  { allergens: ['mustard'], words: ['mustard', 'sarson', 'rai'] },
];

module.exports = {
  DIET_TYPES, MEAL_SLOTS, COURSES, CATEGORIES, CUISINES, ALLERGENS, TAGS,
  SOURCES, DATA_STATUS, DATA_FLAGS, NUTRIENT_UNITS, ALLERGEN_SYNONYMS,
};
