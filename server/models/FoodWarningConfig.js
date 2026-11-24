const mongoose = require('mongoose');

// Versioned thresholds for the meal-warnings rule engine (services/foodDb/mealWarnings.js,
// docs/FOOD_DB_FLOW.md section 9.7). Same pattern as HealthScoreConfig: only one document should
// have isActive:true. Its `config` is deep-merged over the code defaults in
// services/foodDb/warningConfig.js, so it only needs the values being changed, e.g.
//   { version: 2, isActive: true, config: { rules: { hypertension: { sodiumMg: 700 } } } }
// No document at all is fine: the code defaults are used.
const foodWarningConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  isActive: { type: Boolean, default: false },
  config: { type: mongoose.Schema.Types.Mixed, default: {} },
  note: String, // why this version exists, e.g. "nutritionist sign-off 2026-12"
}, { timestamps: true });

foodWarningConfigSchema.index({ isActive: 1 });

module.exports = mongoose.models.FoodWarningConfig || mongoose.model('FoodWarningConfig', foodWarningConfigSchema);
