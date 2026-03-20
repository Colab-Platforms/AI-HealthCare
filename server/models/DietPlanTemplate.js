const mongoose = require('mongoose');

const dietPlanTemplateSchema = new mongoose.Schema({
  name: { type: String, required: true },
  targetDeficiencies: [String],
  ageGroup: { type: String, enum: ['all', 'child', 'adult', 'senior'] },
  gender: { type: String, enum: ['all', 'male', 'female'] },
  overview: String,
  meals: {
    breakfast: [{ meal: String, nutrients: [String], tip: String }],
    lunch: [{ meal: String, nutrients: [String], tip: String }],
    dinner: [{ meal: String, nutrients: [String], tip: String }],
    snacks: [{ meal: String, nutrients: [String], tip: String }]
  },
  foodsToIncrease: [String],
  foodsToLimit: [String],
  tips: [String],
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'pending' },
  createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
  approvedAt: Date,
  isAIGenerated: { type: Boolean, default: false }
}, { timestamps: true });

module.exports = mongoose.model('DietPlanTemplate', dietPlanTemplateSchema);
