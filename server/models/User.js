const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  fcmToken: { type: String, default: null }, // Android/iOS push notification token
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['user', 'admin', 'superadmin', 'patient', 'client', 'doctor'], default: 'user' },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationCode: String,
  emailVerificationExpire: Date,
  profilePicture: { type: String }, // Cloudinary URL
  resetPasswordCode: String,
  resetPasswordExpire: Date,
  // For doctors - links to Doctor profile
  doctorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  profile: {
    age: Number,
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dietaryPreference: { type: String, enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian'], default: 'non-vegetarian' },
    height: Number, // in cm
    weight: Number, // in kg
    bloodGroup: String,
    allergies: [String],
    chronicConditions: [String],
    isDiabetic: { type: String, enum: ['yes', 'no'], default: 'no' },
    avatar: String,
    // New comprehensive health fields
    activityLevel: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'moderate', 'very_active', 'extremely_active'],
      default: 'sedentary'
    },
    medicalHistory: {
      conditions: [String], // diabetes, hypertension, etc.
      surgeries: [String],
      familyHistory: [String],
      currentMedications: [String]
    },
    lifestyle: {
      smoker: { type: Boolean, default: false },
      smokingFrequency: String, // 'occasional', 'regular', 'heavy'
      alcohol: { type: Boolean, default: false },
      alcoholFrequency: String, // 'occasional', 'moderate', 'heavy'
      sleepHours: Number,
      stressLevel: { type: String, enum: ['low', 'moderate', 'high'] },
      waterIntake: Number // glasses per day
    },
    diabetesProfile: {
      type: {
        type: String,
        enum: ['Type 1', 'Type 2', 'Prediabetes', 'Gestational']
      },
      diagnosisYear: Number,
      status: {
        type: String,
        enum: ['Controlled', 'Uncontrolled', 'Newly diagnosed']
      },
      hba1c: Number,
      glucoseMonitoring: String,
      fastingGlucose: String,
      postMealGlucose: String,
      testingFrequency: String,
      onMedication: Boolean,
      medicationType: [String],
      insulinTiming: String,
      recentDosageChange: Boolean
    },
    dietPreferences: {
      cuisinePreference: String,
      mealsPerDay: String,
      restrictions: [String]
    },
    fitnessProfile: {
      exercisePreference: [String],
      primaryGoal: String,
      timeframe: String,
      biggestChallenge: String
    },
    hasSeenMobileTour: { type: Boolean, default: false }
  },
  nutritionGoal: {
    goal: {
      type: String,
      enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'maintenance', 'health_improvement', 'general_health', 'disease_management'],
      default: 'general_health'
    },
    targetWeight: Number, // in kg
    weeklyGoal: Number, // kg per week (0.25, 0.5, 1)
    calorieGoal: Number,
    proteinGoal: Number, // in grams
    carbsGoal: Number, // in grams
    fatGoal: Number, // in grams
    autoCalculated: { type: Boolean, default: true },
    lastUpdated: Date
  },
  foodPreferences: {
    region: { type: String, enum: ['north', 'south', 'east', 'west', 'northeast', 'other'], default: 'other' },
    country: { type: String, default: 'India' },
    preferredFoods: [String], // Foods user likes to eat
    foodsToAvoid: [String], // Foods user wants to avoid
    dietaryRestrictions: [String], // Allergies, intolerances, religious restrictions
    mealPreferences: {
      breakfast: [String],
      lunch: [String],
      snacks: [String],
      dinner: [String]
    },
    lastUpdated: Date
  },
  subscription: {
    plan: { type: String, enum: ['free', 'basic', 'premium'], default: 'free' },
    status: { type: String, enum: ['active', 'inactive', 'expired'], default: 'active' },
    startDate: Date,
    endDate: Date,
    autoRenew: { type: Boolean, default: false }
  },
  healthMetrics: {
    bmi: Number,
    lastCheckup: Date,
    healthScore: { type: Number, min: 0, max: 100 }
  },
  challengeData: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  },
  challengeStartDate: Date,
  streakDays: { type: Number, default: 0 },
  vitalsInsights: {
    weight: {
      status: String,
      analysis: String,
      recommendations: [String],
      encouragement: String,
      lastUpdated: Date
    },
    steps: {
      status: String,
      analysis: String,
      recommendations: [String],
      encouragement: String,
      lastUpdated: Date
    },
    sleep: {
      status: String,
      analysis: String,
      recommendations: [String],
      encouragement: String,
      lastUpdated: Date
    }
  },
  loginCount: {
    type: Number,
    default: 1
  },
  /** Daily smoke log keyed by YYYY-MM-DD (count, sessions, resistedCount). */
  smokeLog: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  },
  /** Daily alcohol log keyed by YYYY-MM-DD (count, units, sessions, cravingEvents). */
  alcoholLog: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({})
  }
}, { timestamps: true, strict: false });

// --- Indexes ---
// Admin/doctor dashboards filter by role + isActive
userSchema.index({ role: 1, isActive: 1 });
// Password reset lookup (called on every forgot-password verify)
userSchema.index({ resetPasswordCode: 1, resetPasswordExpire: 1 }, { sparse: true });
// Profile queries by subscription plan
userSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 }, { sparse: true });

userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  // Use 10 rounds (not 12) - still secure but ~4x faster on serverless
  this.password = await bcrypt.hash(this.password, 10);
  next();
});

userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
