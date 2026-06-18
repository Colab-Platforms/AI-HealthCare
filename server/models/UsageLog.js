const mongoose = require('mongoose');

// Pricing per million tokens (USD) — update when Anthropic changes pricing
const MODEL_PRICING = {
    'claude-sonnet-4-6':       { input: 3.00,  output: 15.00, cacheRead: 0.30,  cacheWrite: 3.75 },
    'claude-haiku-4-5':        { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25 },
    'claude-haiku-4-5-20251001': { input: 1.00, output: 5.00, cacheRead: 0.10,  cacheWrite: 1.25 },
    'claude-3-5-haiku-latest': { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25 },
    'claude-4-haiku-latest':   { input: 1.00,  output: 5.00,  cacheRead: 0.10,  cacheWrite: 1.25 },
    'claude-opus-4-8':         { input: 5.00,  output: 25.00, cacheRead: 0.50,  cacheWrite: 6.25 },
};

const calcCost = (model, inputTokens, outputTokens, cacheReadTokens = 0, cacheWriteTokens = 0) => {
    const pricing = MODEL_PRICING[model] || { input: 3.00, output: 15.00, cacheRead: 0.30, cacheWrite: 3.75 };
    return (
        (inputTokens      * pricing.input      / 1_000_000) +
        (outputTokens     * pricing.output     / 1_000_000) +
        (cacheReadTokens  * pricing.cacheRead  / 1_000_000) +
        (cacheWriteTokens * pricing.cacheWrite / 1_000_000)
    );
};

const usageLogSchema = new mongoose.Schema({
    userId:            { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    feature:           { type: String, required: true, enum: [
        'validate_report', 'analyze_report', 'reanalyze_report',
        'ai_chat', 'chat_about_report', 'metric_info',
        'compare_reports', 'health_dna', 'vitals_insights',
        'diet_plan', 'translate', 'other'
    ]},
    model:             { type: String, required: true },
    inputTokens:       { type: Number, default: 0 },
    outputTokens:      { type: Number, default: 0 },
    cacheReadTokens:   { type: Number, default: 0 },
    cacheWriteTokens:  { type: Number, default: 0 },
    totalTokens:       { type: Number, default: 0 },
    costUsd:           { type: Number, default: 0 },
    durationMs:        { type: Number, default: 0 },
    status:            { type: String, enum: ['success', 'error'], default: 'success' },
    errorMessage:      { type: String, default: null },
    reportId:          { type: mongoose.Schema.Types.ObjectId, ref: 'HealthReport', default: null },
}, { timestamps: true });

// Auto-calc totalTokens + costUsd before save
usageLogSchema.pre('save', function (next) {
    this.totalTokens = this.inputTokens + this.outputTokens + this.cacheReadTokens + this.cacheWriteTokens;
    this.costUsd = calcCost(this.model, this.inputTokens, this.outputTokens, this.cacheReadTokens, this.cacheWriteTokens);
    next();
});

// Indexes for fast aggregation queries
usageLogSchema.index({ createdAt: -1 });
usageLogSchema.index({ userId: 1, createdAt: -1 });
usageLogSchema.index({ feature: 1, createdAt: -1 });
usageLogSchema.index({ model: 1 });
usageLogSchema.index({ status: 1 });

module.exports = mongoose.model('UsageLog', usageLogSchema);
module.exports.calcCost = calcCost;
module.exports.MODEL_PRICING = MODEL_PRICING;
