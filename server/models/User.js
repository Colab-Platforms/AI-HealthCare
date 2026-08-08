const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  fcmToken: { type: String, default: null }, // Android/iOS push notification token
  password: { type: String, required: true, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true }, // Google 'sub' claim, only set for Google sign-ins
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
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
    dietaryPreference: { type: String, enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian', 'other'], default: 'non-vegetarian' },
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
    status: { type: String, enum: ['active', 'inactive', 'expired', 'past_due', 'cancelled'], default: 'active' },
    billingCycle: { type: String, enum: ['monthly', 'yearly'], default: 'monthly' },
    startDate: Date,
    endDate: Date,
    currentPeriodEnd: Date, // authoritative expiry check, independent of `status` webhook lag
    statusUpdatedAt: Date, // when `status` last changed — used to time out the past_due grace period
    autoRenew: { type: Boolean, default: false },
    razorpayCustomerId: String,
    razorpaySubscriptionId: String, // only set if the account is on the Subscriptions (auto-renew) flow
    renewalReminderSentAt: Date, // dedupes the manual-renewal reminder email while on the one-time-payment flow
  },
  healthMetrics: {
    bmi: Number,
    lastCheckup: Date,
    // Legacy: AI-generated per-report score (LLM's own judgment call, not a
    // formula). Superseded by `compositeHealthScore` below — kept only so
    // old reports don't break; do not write new values here.
    healthScore: { type: Number, min: 0, max: 100 }
  },
  // The Overall Health Score (see docs/health-score-formulas.md) — the
  // single trustworthy composite number: Clinical + Today + Consistency +
  // Trend, multiplicatively capped by RiskAdjustmentFactor. Recomputed weekly
  // and instantly on a new report upload.
  compositeHealthScore: {
    value: { type: Number, min: 0, max: 100 },
    components: {
      clinical: Number,
      today: Number, // today's Daily Score — see longTermHealthScoreService
      consistency: Number,
      trend: Number,
    },
    riskAdjustmentFactor: Number,
    // Lab values in critical ("panic value") range on the latest report. When
    // non-empty the score is capped — see criticalFindingScoreCap.
    criticalFindings: [{
      marker: String,
      value: Number,
      unit: String,
      direction: { type: String, enum: ['low', 'high'] },
    }],
    daysOfHistory: Number, // drives the "based on N days" confidence hint in the UI
    configVersion: Number,
    computedAt: Date,
  },
  gamification: {
    totalPoints: { type: Number, default: 0 },
    currentTier: { 
      type: String, 
      enum: ['Health Novice', 'Wellness Warrior', 'Fitness Champion', 'Health Master'],
      default: 'Health Novice'
    },
    badges: [{
      badgeId: String,
      name: String,
      icon: String,
      earnedAt: { type: Date, default: Date.now }
    }],
    lastPointsAwardedAt: Date
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
  },

  // DPDPA Compliance fields
  consent: {
    given:      { type: Boolean, default: false },
    version:    { type: String, default: null },   // policy version agreed to
    givenAt:    { type: Date,   default: null },
    withdrawn:  { type: Boolean, default: false },
    withdrawnAt:{ type: Date,   default: null },
  },
  dataRetention: {
    scheduledDeletion: { type: Date, default: null }, // set when user requests account delete
    deletionRequestedAt: { type: Date, default: null },
  },
  privacySettings: {
    analyticsEnabled:   { type: Boolean, default: true },
    marketingEnabled:   { type: Boolean, default: false },
    dataSharing:        { type: Boolean, default: false },
  }
}, { timestamps: true, strict: false });

// --- Indexes ---
// Admin/doctor dashboards filter by role + isActive
userSchema.index({ role: 1, isActive: 1 });
// Password reset lookup (called on every forgot-password verify)
userSchema.index({ resetPasswordCode: 1, resetPasswordExpire: 1 }, { sparse: true });
// Profile queries by subscription plan
userSchema.index({ 'subscription.plan': 1, 'subscription.status': 1 }, { sparse: true });
// Admin stats/growth charts filter by signup date range collection-wide
userSchema.index({ createdAt: 1 });

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
