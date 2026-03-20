const mongoose = require('mongoose');

const dailyProgressSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    date: {
        type: String, // YYYY-MM-DD format
        required: true
    },
    totalScore: { type: Number, default: 0 },
    nutritionScore: { type: Number, default: 0 },
    sleepScore: { type: Number, default: 0 },
    hydrationScore: { type: Number, default: 0 },
    stressScore: { type: Number, default: 0 },
    waterIntake: { type: Number, default: 0 },
    updatedAt: { type: Date, default: Date.now }
});

// Compound index for fast lookup
dailyProgressSchema.index({ userId: 1, date: 1 }, { unique: true });

module.exports = mongoose.model('DailyProgress', dailyProgressSchema);
