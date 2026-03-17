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
    required: true,
    index: true 
  },
  searchDescription: {
    type: String,
    index: true // New field to store exactly what user searched for
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
  imageUrl: String,
  scanType: {
    type: String,
    enum: ['barcode', 'image', 'text'],
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
