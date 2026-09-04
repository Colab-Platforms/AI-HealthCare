const mongoose = require('mongoose');

const waitlistUserEmailSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Name is required'],
        trim: true,
        maxlength: [50, 'Name cannot exceed 50 characters'],
        minlength: [2, 'Name must be at least 2 characters']
    },
    email: {
        type: String,
        required: [true, 'Email is required'],
        unique: [true, 'This email is already on our waitlist'],
        lowercase: true,
        trim: true,
        index: true,
        match: [/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'Please provide a valid email']
    },
    position: {
        type: Number,
        required: true,
        index: true
    },
    // Email tracking
    emailSent: {
        type: Boolean,
        default: false,
        index: true
    },
    emailSendError: String,
    emailRetryCount: {
        type: Number,
        default: 0
    },
    maxRetries: {
        type: Number,
        default: 3
    },
    lastEmailAttempt: Date,
    
    // User engagement
    emailOpenedAt: Date,
    linkClickedAt: Date,
    convertedAt: Date,
    
    // Admin fields
    notes: [String],
    priority: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    status: {
        type: String,
        enum: ['pending', 'emailed', 'converted', 'unsubscribed'],
        default: 'pending'
    },
    source: {
        type: String,
        default: 'waitlist_page',
        enum: ['waitlist_page', 'landing_page', 'referral', 'other']
    }
}, { 
    timestamps: true,
    strict: true 
});

// Indexes for efficient queries
// (position already gets its index via `index: true` on the field above)
waitlistUserEmailSchema.index({ email: 1, createdAt: -1 });
waitlistUserEmailSchema.index({ createdAt: -1 });
waitlistUserEmailSchema.index({ status: 1, emailSent: 1 });
waitlistUserEmailSchema.index({ convertedAt: 1 }, { sparse: true });

// Pre-save middleware
waitlistUserEmailSchema.pre('save', function(next) {
    if (this.email) {
        this.email = this.email.toLowerCase().trim();
    }
    next();
});

// Instance methods
waitlistUserEmailSchema.methods.markAsConverted = function() {
    this.status = 'converted';
    this.convertedAt = new Date();
    return this.save();
};

waitlistUserEmailSchema.methods.unsubscribe = function() {
    this.status = 'unsubscribed';
    return this.save();
};

// Static method for analytics
waitlistUserEmailSchema.statics.getEngagementStats = async function() {
    const total = await this.countDocuments();
    const emailed = await this.countDocuments({ status: 'emailed' });
    const converted = await this.countDocuments({ status: 'converted' });
    const unsubscribed = await this.countDocuments({ status: 'unsubscribed' });

    return {
        total,
        emailed,
        converted,
        conversionRate: total > 0 ? ((converted / total) * 100).toFixed(2) + '%' : '0%',
        unsubscribed
    };
};

module.exports = mongoose.model('WaitlistUserEmail', waitlistUserEmailSchema);
