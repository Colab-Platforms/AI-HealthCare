/**
 * Food reference database: one document per dish/food.
 * Design: docs/FOOD_DB_FLOW.md section 5. Seeded by scripts/foodDb/importFoodSeed.js.
 *
 * Nutrition is stored per 100 g only; portions are calculated at request time
 * (value × grams / 100). Units for every nutrient: services/foodDb/vocab.js NUTRIENT_UNITS.
 */
const mongoose = require('mongoose');
const V = require('../services/foodDb/vocab');

const { Schema } = mongoose;

const nutritionPer100gSchema = new Schema({
  calories: { type: Number, required: true, min: 0 },
  protein: { type: Number, required: true, min: 0 },
  carbs: { type: Number, required: true, min: 0 },
  fats: { type: Number, required: true, min: 0 },
  fiber: { type: Number, default: null },
  sugar: { type: Number, default: null },
  sodium: { type: Number, default: null },
  satFat: { type: Number, default: null },
  cholesterol: { type: Number, default: null },
  potassium: { type: Number, default: null },
  calcium: { type: Number, default: null },
  iron: { type: Number, default: null },
  vitaminC: { type: Number, default: null },
}, { _id: false });

// Free-form numeric map (keys listed in vocab NUTRIENT_UNITS.micronutrientsPer100g); null when unknown.
const micronutrientsSchema = new Schema(
  Object.fromEntries(Object.keys(V.NUTRIENT_UNITS.micronutrientsPer100g).map((k) => [k, { type: Number, default: null }])),
  { _id: false },
);

const ingredientNutritionSchema = new Schema({
  calories: Number, protein: Number, carbs: Number, fats: Number, fiber: Number, sugar: Number, sodium: Number,
}, { _id: false });

const ingredientSchema = new Schema({
  ingredientId: String,
  name: { type: String, required: true },
  gramsPerServing: Number, // raw ingredient weight for one default serving
  share: Number,
  nutritionPerServing: ingredientNutritionSchema,
}, { _id: false });

const servingUnitSchema = new Schema({
  unit: { type: String, required: true },
  grams: { type: Number, required: true, min: 0 },
}, { _id: false });

const foodSchema = new Schema({
  foodId: { type: String, required: true, unique: true, trim: true }, // THF-00001 (seed)
  name: { type: String, required: true, trim: true },
  aliases: { type: [String], default: [] }, // lowercase
  searchText: { type: String, default: '' }, // normalised tokens of name + aliases (services/foodDb/normalize.js)
  description: { type: String, default: null },

  classification: {
    dietType: { type: String, enum: V.DIET_TYPES, required: true },
    mealSlots: { type: [{ type: String, enum: V.MEAL_SLOTS }], default: [] },
    course: { type: String, enum: V.COURSES },
    category: { type: String, enum: V.CATEGORIES },
    cuisine: { type: String, enum: V.CUISINES, default: 'indian' },
    regions: { type: [String], default: [] },
  },

  allergens: { type: [{ type: String, enum: V.ALLERGENS }], default: [] },
  tags: { type: [{ type: String, enum: V.TAGS }], default: [] },

  serving: {
    defaultUnit: { type: String, required: true },
    defaultGrams: { type: Number, required: true, min: 0 },
    units: { type: [servingUnitSchema], default: [] },
  },

  nutritionPer100g: { type: nutritionPer100gSchema, required: true },
  micronutrientsPer100g: { type: micronutrientsSchema, default: null },
  glycemicIndex: { type: Number, default: null, min: 0, max: 120 },
  ingredients: { type: [ingredientSchema], default: [] },
  cookMinutes: Number,
  prepMinutes: Number,

  source: {
    primary: { type: String, enum: V.SOURCES, required: true },
    anuvaadCode: { type: String, default: null },
    anuvaadSource: { type: String, default: null },
    indDishId: { type: String, default: null },
    aiModel: { type: String, default: null },
    createdFromScanId: { type: Schema.Types.ObjectId, default: null },
  },

  dataQuality: {
    status: { type: String, enum: V.DATA_STATUS, default: 'estimated' },
    estimatedFields: { type: [String], default: [] },
    flags: { type: [{ type: String, enum: V.DATA_FLAGS }], default: [] },
    checksPassed: { type: Boolean, default: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: null },
  },
  // Set when an admin merges this food into another (section 8.4); the doc stays, inactive, so past
  // scans that reference this foodId still resolve and the name is never auto-saved again.
  mergedInto: { type: String, default: null },

  stats: {
    hitCount: { type: Number, default: 0 },
    lastMatchedAt: { type: Date, default: null },
  },

  isActive: { type: Boolean, default: true },
}, {
  timestamps: true,
  collection: 'foods',
});

// Section 5.3. One text index per collection; language 'none' so Hindi/Hinglish words are not stemmed as English.
foodSchema.index(
  { name: 'text', aliases: 'text', searchText: 'text' },
  { name: 'food_text', weights: { name: 10, aliases: 5, searchText: 2 }, default_language: 'none' },
);
foodSchema.index({ isActive: 1, 'dataQuality.status': 1 });
foodSchema.index({ 'dataQuality.status': 1, 'stats.hitCount': -1 }); // admin review queue
foodSchema.index({ 'classification.dietType': 1, 'classification.mealSlots': 1 }); // diet recommendations (phase 2)
foodSchema.index({ 'source.anuvaadCode': 1 }, { sparse: true });
foodSchema.index({ 'source.indDishId': 1 }, { sparse: true });

module.exports = mongoose.models.Food || mongoose.model('Food', foodSchema);
