const mongoose = require('mongoose');

const deficiencyRuleSchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true },
  description: String,
  biomarker: { type: String, required: true },
  unit: String,
  thresholds: {
    severe: { min: Number, max: Number },
    moderate: { min: Number, max: Number },
    mild: { min: Number, max: Number },
    normal: { min: Number, max: Number }
  },
  symptoms: [String],
  isEnabled: { type: Boolean, default: true }
}, { timestamps: true });

module.exports = mongoose.model('DeficiencyRule', deficiencyRuleSchema);
