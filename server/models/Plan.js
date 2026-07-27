const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        enum: ['free', 'basic', 'premium'],
    },
    name: { type: String, required: true },
    billingCycle: {
        type: String,
        enum: ['monthly', 'yearly'],
        required: true,
    },
    price: { type: Number, required: true }, // in INR, whole rupees
    razorpayPlanId: { type: String }, // null for the free plan
    features: {
        reportAnalysesPerMonth: { type: Number, default: 1 }, // -1 = unlimited
        aiChatPerDay: { type: Number, default: 3 },
        dietPlansPerMonth: { type: Number, default: 0 },
        supplementRecommendations: { type: Boolean, default: false },
        videoConsultAccess: { type: Boolean, default: false },
        prioritySupport: { type: Boolean, default: false },
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// A plan is uniquely identified by tier + billing cycle (basic+monthly vs basic+yearly are different Razorpay plans).
// Only enforced among active plans — price changes deactivate the old record and insert a
// new one with the same key+billingCycle, which the sync script relies on.
planSchema.index({ key: 1, billingCycle: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Plan', planSchema);
