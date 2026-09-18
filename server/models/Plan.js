const mongoose = require('mongoose');

const planSchema = new mongoose.Schema({
    key: {
        type: String,
        required: true,
        enum: ['free', 'free_trial', 'basic', 'premium'],
    },
    name: { type: String, required: true },
    billingCycle: {
        type: String,
        enum: ['monthly', 'quarterly', 'yearly'], // 'yearly' kept only so pre-existing inactive plan docs stay valid
        required: true,
    },
    price: { type: Number, required: true }, // in INR, whole rupees
    razorpayPlanId: { type: String }, // null for the free plan
    // Freeform feature map: { [featureKey]: true|false }. All features are plain
    // access flags now (no numeric usage limits) — see requireFeature in
    // middleware/subscriptionAccess.js. Add a feature by editing PLAN_DEFINITIONS
    // in scripts/syncRazorpayPlans.js and re-running it; no schema change needed.
    features: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    isActive: { type: Boolean, default: true },
}, { timestamps: true });

// A plan is uniquely identified by tier + billing cycle (basic+monthly vs basic+yearly are different Razorpay plans).
// Only enforced among active plans — price changes deactivate the old record and insert a
// new one with the same key+billingCycle, which the sync script relies on.
planSchema.index({ key: 1, billingCycle: 1 }, { unique: true, partialFilterExpression: { isActive: true } });

module.exports = mongoose.model('Plan', planSchema);
