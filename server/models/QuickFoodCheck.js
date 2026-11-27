const mongoose = require('mongoose');

const quickFoodCheckSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  foodName: {
    type: String,
    required: true,
    index: true
  },
  searchDescription: {
    type: String, // exactly what the user searched for
  },
  quantity: String,
  calories: Number,
  protein: Number,
  carbs: Number,
  fats: Number,
  fiber: Number,
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fats: Number,
    fiber: Number,
    sugar: Number,
    sodium: Number,
    // Food DB scan only (same names as FoodLog: saturatedFat in g; the rest in mg)
    saturatedFat: Number,
    cholesterol: Number,
    potassium: Number,
    calcium: Number,
    iron: Number,
    vitaminC: Number
  },
  healthScore: {
    type: Number,
    min: 0,
    max: 100
  },
  healthScore10: {
    type: Number,
    min: 0,
    max: 10
  },
  isHealthy: Boolean,
  analysis: String,
  micronutrients: [{
    name: String,
    value: String,
    percentage: Number
  }],
  enhancementTips: [{
    name: String,
    benefit: String
  }],
  warnings: [String],
  benefits: [{
    name: String,
    benefit: String
  }],
  healthBenefitsSummary: String,
  alternatives: [{
    name: String,
    description: String,
    nutrition: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fats: Number,
      fiber: Number
    },
    benefits: String,
    satietyScore: Number,
    prepTime: String
  }],
  analysisTier: {
    type: String,
    enum: ['basic', 'full'],
    default: 'full'
  },
  imageUrl: String, // primary/first image — kept for backward-compat with existing UI
  imageUrls: [String], // full set of uploaded photos when multi-photo scan is used
  dishes: [{
    name: String,
    quantity: String,
    ingredients: [{
      name: String,
      quantity: String,
      nutrition: {
        calories: Number,
        protein: Number,
        carbs: Number,
        fats: Number,
        fiber: Number,
        sugar: Number,
        sodium: Number
      }
    }],
    nutrition: {
      calories: Number,
      protein: Number,
      carbs: Number,
      fats: Number,
      fiber: Number,
      sugar: Number,
      sodium: Number,
      // Food DB scan only (same names as FoodLog: saturatedFat in g; the rest in mg)
      saturatedFat: Number,
      cholesterol: Number,
      potassium: Number,
      calcium: Number,
      iron: Number,
      vitaminC: Number
    },
    healthScore: Number,
    // Food DB scan (docs/FOOD_DB_FLOW.md section 7.2) — absent on AI-only scans
    foodId: String,
    grams: Number,
    matchScore: Number,
    source: { type: String, enum: ['food_db', 'ai_fallback'] },
    dataStatus: String,
    glycemicIndex: Number,
    allergens: [String]
  }],
  // Where the nutrition came from: 'ai' = the original AI-only flow; the rest = Food DB scan
  source: { type: String, enum: ['ai', 'food_db', 'ai_fallback', 'mixed'], default: 'ai' },
  scanType: {
    type: String,
    enum: ['barcode', 'image', 'multi_image', 'text'],
    default: 'text'
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for global cache lookups by exact search description
quickFoodCheckSchema.index({ searchDescription: 1 });

// Index for querying user's quick checks by date
quickFoodCheckSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('QuickFoodCheck', quickFoodCheckSchema);
