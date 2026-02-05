const mongoose = require('mongoose');

const healthReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportType: { type: String, required: true },
  patientName: { type: String, description: 'Patient name extracted from report for validation' },
  originalFile: { filename: String, path: String, mimetype: String },
  extractedText: String,
  reportDate: { type: Date, description: 'Date mentioned in the report (Reported On)' },
  aiAnalysis: {
    summary: String,
    keyFindings: [String],
    riskFactors: [String],
    healthScore: Number,
    metrics: mongoose.Schema.Types.Mixed,
    deficiencies: [{
      name: String,
      severity: { type: String, enum: ['mild', 'moderate', 'severe'] },
      currentValue: String,
      normalRange: String,
      symptoms: [String]
    }],
    supplements: [{
      category: String,
      reason: String,
      generalDosage: String,
      note: String
    }],
    dietPlan: {
      overview: String,
      breakfast: [{ meal: String, nutrients: [String], tip: String }],
      lunch: [{ meal: String, nutrients: [String], tip: String }],
      dinner: [{ meal: String, nutrients: [String], tip: String }],
      snacks: [{ meal: String, nutrients: [String], tip: String }],
      foodsToIncrease: [String],
      foodsToLimit: [String],
      hydration: String,
      tips: [String]
    },
    fitnessPlan: {
      overview: String,
      cardio: String,
      strength: String,
      flexibility: String,
      frequency: String,
      duration: String,
      intensity: String,
      precautions: [String],
      progressionPlan: String,
      exercises: [{
        name: String,
        duration: String,
        frequency: String,
        description: String
      }],
      tips: [String]
    },
    recommendations: {
      immediate: [String],
      shortTerm: [String],
      longTerm: [String],
      lifestyle: [String],
      tests: [String]
    },
    doctorConsultation: {
      recommended: Boolean,
      urgency: { type: String, enum: ['low', 'medium', 'high', 'urgent'] },
      specializations: [String],
      reason: String
    },
    overallTrend: String
  },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' }
}, { timestamps: true });

module.exports = mongoose.model('HealthReport', healthReportSchema);
