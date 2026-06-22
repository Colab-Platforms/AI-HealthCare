const mongoose = require('mongoose');

const aiAnalysisSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    type: {
        type: String,
        enum: ['glucose_trends', 'diet_analysis', 'weight_trends'],
        required: true
    },
    lastDataPointsHash: {
        type: String,
        required: true
    },
    analysisData: {
        type: mongoose.Schema.Types.Mixed,
        required: true
    }
}, { timestamps: true });

aiAnalysisSchema.index({ userId: 1, type: 1 });
aiAnalysisSchema.index({ userId: 1, createdAt: -1 }); // dashboard fetches latest analysis

module.exports = mongoose.model('AIAnalysis', aiAnalysisSchema);
