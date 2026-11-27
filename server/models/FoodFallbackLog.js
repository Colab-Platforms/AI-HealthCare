const mongoose = require('mongoose');

// AI-fallback results that were NOT saved to `foods` (docs/FOOD_DB_FLOW.md section 8.2):
// failed checks, not a generic food, or the name was rejected before. The AI values were still
// used for that one scan. Admins review these to add the food by hand. Kept 180 days.
const foodFallbackLogSchema = new mongoose.Schema({
  scannedName: { type: String, required: true },   // what the identifier called it
  aiName: String,                                   // what the fallback called it
  outcome: { type: String, enum: ['failed_checks', 'not_generic', 'previously_rejected', 'ai_error'], required: true },
  reasons: [String],
  aiOutput: mongoose.Schema.Types.Mixed,
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  createdAt: { type: Date, default: Date.now, expires: 60 * 60 * 24 * 180 },
});

foodFallbackLogSchema.index({ outcome: 1, createdAt: -1 });

module.exports = mongoose.models.FoodFallbackLog || mongoose.model('FoodFallbackLog', foodFallbackLogSchema);
