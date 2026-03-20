const mongoose = require('mongoose');

const supplementRecommendationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  generatedAt: {
    type: Date,
    default: Date.now
  },
  
  // Deficiencies addressed
  deficiencies: [{
    nutrient: String,
    severity: String,
    labValue: String,
    reportId: mongoose.Schema.Types.ObjectId
  }],

  // Supplement recommendations
  supplements: [{
    name: String,
    deficiency: String,
    dosage: String,
    timing: String,
    reason: String,
    foodAlternatives: [String],
    precautions: String,
    indianBrands: [String],
    priority: {
      type: String,
      enum: ['high', 'medium', 'low'],
      default: 'medium'
    }
  }],

  generalGuidance: [String],
  consultationNote: String,

  // User tracking
  userStartedTaking: [{
    supplementName: String,
    startDate: Date,
    dosage: String,
    notes: String
  }],

  // Status
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Index for efficient queries
supplementRecommendationSchema.index({ userId: 1, isActive: 1, generatedAt: -1 });

module.exports = mongoose.model('SupplementRecommendation', supplementRecommendationSchema);
