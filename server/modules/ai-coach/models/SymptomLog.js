const mongoose = require('mongoose');

// Symptom episodes the user mentions in chat ("stomach burning for a few
// days"). Not part of the HealthProfile: symptoms come and go. An episode
// stays `active` until the USER says it's gone; the coach follows up every
// couple of days until then (users forget to say so). Active episodes also
// shape advice (gentle food while the stomach is upset).
// Health data: covered by DPDPA delete and export.

const updateSchema = new mongoose.Schema({
    at: { type: Date, required: true },
    status: { type: String, enum: ['better', 'same', 'worse', 'resolved'], required: true },
}, { _id: false });

const symptomLogSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },     // short English, e.g. "stomach burning"
    key: { type: String, required: true },                                  // lowercase name, for matching
    status: { type: String, enum: ['active', 'resolved'], default: 'active' },
    startedAt: { type: Date, required: true },                              // first mentioned
    lastMentionedAt: { type: Date, required: true },
    lastAskedAt: { type: Date, default: null },                             // last coach follow-up
    askCount: { type: Number, default: 0 },
    lastStatus: { type: String, enum: ['new', 'better', 'same', 'worse', 'resolved'], default: 'new' },
    resolvedAt: { type: Date, default: null },
    updates: { type: [updateSchema], default: [] },
}, { timestamps: true, collection: 'symptom_logs' });

symptomLogSchema.index({ user: 1, status: 1, lastMentionedAt: -1 });
// One active episode per symptom per user.
symptomLogSchema.index({ user: 1, key: 1 }, { unique: true, partialFilterExpression: { status: 'active' } });

module.exports = mongoose.models.SymptomLog || mongoose.model('SymptomLog', symptomLogSchema);
