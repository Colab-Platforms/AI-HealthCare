const mongoose = require('mongoose');

const healthMetricSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    type: {
        type: String,
        enum: ['blood_sugar', 'hba1c', 'weight', 'blood_pressure', 'heart_rate'],
        required: true
    },
    value: {
        type: Number,
        required: true
    },
    unit: {
        type: String,
        required: true
    },
    readingContext: {
        type: String // fasting, after_meal, etc.
    },
    recordedAt: {
        type: Date,
        default: Date.now
    },
    notes: String
}, { timestamps: true });

// Index for efficient querying by user and type
healthMetricSchema.index({ userId: 1, type: 1, recordedAt: -1 });

module.exports = mongoose.model('HealthMetric', healthMetricSchema);
