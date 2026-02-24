const mongoose = require('mongoose');

const quickFoodCheckSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  foodName: {
    type: String,
    required: true
  },
  quantity: String,
  calories: Number,
  protein: Number,
  carbs: Number,
  fats: Number,
  nutrition: {
    calories: Number,
    protein: Number,
    carbs: Number,
    fats: Number,
    fiber: Number,
    sugar: Number,
    sodium: Number
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
  benefits: [String],
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
  imageUrl: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for querying user's quick checks by date
quickFoodCheckSchema.index({ userId: 1, timestamp: -1 });

module.exports = mongoose.model('QuickFoodCheck', quickFoodCheckSchema);
