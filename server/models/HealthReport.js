const mongoose = require('mongoose');

const healthReportSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  reportType: { type: String, required: true },
  patientName: { type: String, description: 'Patient name extracted from report for validation' },
  patientAge: { type: Number, description: 'Patient age extracted from report' },
  patientGender: { type: String, description: 'Patient gender extracted from report' },
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
      severity: { type: String, enum: ['mild', 'moderate', 'severe', 'low', 'high', 'mild-moderate', 'moderate-severe'] },
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
      breakfast: [{ meal: String, nutrients: [String], tip: String, calories: Number, protein: Number, carbs: Number, fats: Number }],
      midMorningSnack: [{ meal: String, nutrients: [String], tip: String, calories: Number, protein: Number, carbs: Number, fats: Number }],
      lunch: [{ meal: String, nutrients: [String], tip: String, calories: Number, protein: Number, carbs: Number, fats: Number }],
      eveningSnack: [{ meal: String, nutrients: [String], tip: String, calories: Number, protein: Number, carbs: Number, fats: Number }],
      dinner: [{ meal: String, nutrients: [String], tip: String, calories: Number, protein: Number, carbs: Number, fats: Number }],
      foodsToIncrease: [String],
      foodsToLimit: [String],
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
      urgency: { type: String, enum: ['low', 'medium', 'moderate', 'high', 'urgent'] },
      specializations: [String],
      reason: String
    },
    overallTrend: String
  },
  comparison: {
    previousReportId: { type: mongoose.Schema.Types.ObjectId, ref: 'HealthReport' },
    previousReportDate: Date,
    data: mongoose.Schema.Types.Mixed
  },
  status: { type: String, enum: ['pending', 'processing', 'completed', 'failed'], default: 'pending' }
}, { timestamps: true });

// ✅ PRE-SAVE HOOK: Fix array validation issues BEFORE MongoDB validation
healthReportSchema.pre('save', function (next) {
  console.log('🔧 [PRE-SAVE HOOK] Running validation fixes...');

  if (this.aiAnalysis) {
    // Fix deficiencies - check if it's an array of strings instead of objects
    if (Array.isArray(this.aiAnalysis.deficiencies)) {
      // Check if array contains strings instead of objects
      if (this.aiAnalysis.deficiencies.length > 0 && typeof this.aiAnalysis.deficiencies[0] === 'string') {
        console.log('🔧 [PRE-SAVE] Converting deficiencies array of strings to array of objects');
        this.aiAnalysis.deficiencies = this.aiAnalysis.deficiencies.map(def => ({
          name: def,
          severity: 'moderate',
          currentValue: 'N/A',
          normalRange: 'N/A',
          symptoms: []
        }));
      }
    } else if (!Array.isArray(this.aiAnalysis.deficiencies)) {
      console.log('🔧 [PRE-SAVE] Fixing deficiencies:', typeof this.aiAnalysis.deficiencies);
      if (typeof this.aiAnalysis.deficiencies === 'string') {
        this.aiAnalysis.deficiencies = [{
          name: this.aiAnalysis.deficiencies,
          severity: 'moderate',
          currentValue: 'N/A',
          normalRange: 'N/A',
          symptoms: []
        }];
      } else {
        this.aiAnalysis.deficiencies = [];
      }
    }

    // New Fix for deficiencies severity enum mapping
    if (Array.isArray(this.aiAnalysis.deficiencies)) {
      this.aiAnalysis.deficiencies.forEach(def => {
        if (def.severity) {
          const sev = def.severity.toLowerCase().trim();
          if (sev === 'high' || sev === 'urgent') def.severity = 'severe';
          else if (sev === 'low' || sev === 'minor') def.severity = 'mild';
          else if (sev.includes('mild') && sev.includes('mod')) def.severity = 'mild-moderate';
          else if (sev.includes('mod') && sev.includes('sev')) def.severity = 'moderate-severe';
          else if (!['mild', 'moderate', 'severe', 'mild-moderate', 'moderate-severe'].includes(sev)) def.severity = 'moderate';
        } else {
          def.severity = 'moderate';
        }
      });
      this.markModified('aiAnalysis.deficiencies');
    }

    // Fix supplements - check if it's an array of strings instead of objects
    if (Array.isArray(this.aiAnalysis.supplements)) {
      // Check if array contains strings instead of objects
      if (this.aiAnalysis.supplements.length > 0 && typeof this.aiAnalysis.supplements[0] === 'string') {
        console.log('🔧 [PRE-SAVE] Converting supplements array of strings to array of objects');
        this.aiAnalysis.supplements = this.aiAnalysis.supplements.map(supp => ({
          category: 'General Health',
          reason: supp,
          naturalSources: 'Consult healthcare professional',
          note: 'Consult doctor for dosage'
        }));
      }
    } else if (!Array.isArray(this.aiAnalysis.supplements)) {
      console.log('🔧 [PRE-SAVE] Fixing supplements:', typeof this.aiAnalysis.supplements);
      if (typeof this.aiAnalysis.supplements === 'string') {
        this.aiAnalysis.supplements = [{
          category: 'General Health',
          reason: this.aiAnalysis.supplements,
          naturalSources: 'Consult healthcare professional',
          note: 'Consult doctor for dosage'
        }];
      } else {
        this.aiAnalysis.supplements = [];
      }
    }

    // Fix keyFindings
    if (!Array.isArray(this.aiAnalysis.keyFindings)) {
      console.log('🔧 [PRE-SAVE] Fixing keyFindings');
      if (typeof this.aiAnalysis.keyFindings === 'string') {
        this.aiAnalysis.keyFindings = [this.aiAnalysis.keyFindings];
      } else {
        this.aiAnalysis.keyFindings = [];
      }
    }

    // Fix riskFactors
    if (this.aiAnalysis.riskFactors && !Array.isArray(this.aiAnalysis.riskFactors)) {
      console.log('🔧 [PRE-SAVE] Fixing riskFactors');
      if (typeof this.aiAnalysis.riskFactors === 'string') {
        this.aiAnalysis.riskFactors = [this.aiAnalysis.riskFactors];
      } else {
        this.aiAnalysis.riskFactors = [];
      }
    }

    // Fix doctorConsultation urgency
    if (this.aiAnalysis.doctorConsultation && this.aiAnalysis.doctorConsultation.urgency) {
      const urgency = this.aiAnalysis.doctorConsultation.urgency.toLowerCase();
      const validUrgencies = ['low', 'medium', 'moderate', 'high', 'urgent'];
      
      if (!validUrgencies.includes(urgency)) {
        console.log('🔧 [PRE-SAVE] Fixing doctorConsultation.urgency:', urgency);
        if (urgency.includes('low')) this.aiAnalysis.doctorConsultation.urgency = 'low';
        else if (urgency.includes('med') || urgency.includes('mod')) this.aiAnalysis.doctorConsultation.urgency = 'medium';
        else if (urgency.includes('high')) this.aiAnalysis.doctorConsultation.urgency = 'high';
        else if (urgency.includes('urg')) this.aiAnalysis.doctorConsultation.urgency = 'urgent';
        else this.aiAnalysis.doctorConsultation.urgency = 'low'; // Default
      }
    }

    console.log('✅ [PRE-SAVE] Validation fixes complete');
    console.log('✅ [PRE-SAVE] Deficiencies:', this.aiAnalysis.deficiencies?.length, 'items');
    console.log('✅ [PRE-SAVE] Supplements:', this.aiAnalysis.supplements?.length, 'items');
  }

  next();
});

// Add indexes for faster queries as we scale
healthReportSchema.index({ user: 1, createdAt: -1 });
healthReportSchema.index({ user: 1, reportType: 1 });

module.exports = mongoose.model('HealthReport', healthReportSchema);
