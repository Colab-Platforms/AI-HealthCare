const mongoose = require('mongoose');
const { FORMS, FREQUENCIES, UNITS } = require('../utils/supplementSchedule');

// Curated products a user can pick instead of typing. Picking one pre-fills the
// "add to routine" form (form, strength, quantity, frequency, times). DB-driven so
// a new product is a seed/insert, not a deploy. Distinct from SupplementMapping /
// SupplementRecommendation, which map deficiencies to supplement *categories*.
const supplementCatalogSchema = new mongoose.Schema({
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    name: { type: String, required: true, trim: true },
    tagline: { type: String, default: '' }, // "Metabolic support"
    form: { type: String, enum: FORMS, required: true },
    strength: { // per unit (per capsule), not per day
        value: { type: Number, required: true },
        unit: { type: String, enum: UNITS, required: true },
    },
    quantityPerDose: { type: Number, default: 1 },
    defaultFrequency: { type: String, enum: FREQUENCIES, default: 'once' },
    // Optional override of the frequency's generic default times (e.g. a bedtime product).
    defaultTimes: [{ type: String }],
    dailyTotal: { // informational: strength x quantity x doses/day
        value: Number,
        unit: { type: String, enum: UNITS },
    },
    recommendedUsage: { type: String, default: '' },
    recommendedDuration: {
        minDays: Number,
        maxDays: Number,
        text: String,
    },
    isActive: { type: Boolean, default: true },
    sortOrder: { type: Number, default: 0 },
}, { timestamps: true });

// slug is indexed by `unique: true`. The catalog read is always
// find({ isActive: true }).sort({ sortOrder: 1 }) over a handful of documents.

module.exports = mongoose.model('SupplementCatalog', supplementCatalogSchema);
