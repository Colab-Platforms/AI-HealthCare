const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  fcmToken: { type: String, default: null }, // Android/iOS push notification token
  device_id: { type: String, default: null }, // Currently logged-in device; null means no active session
  password: { type: String, required: true, minlength: 6 },
  googleId: { type: String, unique: true, sparse: true }, // Google 'sub' claim, only set for Google sign-ins
  authProvider: { type: String, enum: ['local', 'google'], default: 'local' },
  role: { type: String, enum: ['user', 'admin', 'superadmin', 'patient', 'client', 'doctor'], default: 'user' },
  isActive: { type: Boolean, default: true },
  isEmailVerified: { type: Boolean, default: false },
  emailVerificationCode: String,
  emailVerificationExpire: Date,
  isPhoneVerified: { type: Boolean, default: false },
  profilePicture: { type: String }, // Cloudinary URL
  resetPasswordCode: String,
  resetPasswordExpire: Date,
  resetPasswordAttempts: { type: Number, default: 0 },
  // DPDPA Section 9: processing a child's (under-18) personal data requires
  // verifiable parental/guardian consent.
  guardianConsent: {
    given: { type: Boolean, default: false },
    guardianName: String,
    guardianEmail: String,
    relation: String,
    consentedAt: Date,
  },
  // For doctors - links to Doctor profile
  doctorProfile: { type: mongoose.Schema.Types.ObjectId, ref: 'Doctor' },
  profile: {
    age: { type: Number, min: 0, max: 120 },
    gender: { type: String, enum: ['male', 'female', 'other'] },
    dietaryPreference: { type: String, enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian', 'other'], default: 'non-vegetarian' },
    height: { type: Number, min: 0, max: 300 }, // in cm
    weight: { type: Number, min: 0, max: 500 }, // in kg
    bloodGroup: String,
    dateOfBirth: { type: Date },
    allergies: [String],
    chronicConditions: [String],
    isDiabetic: { type: String, enum: ['yes', 'no'], default: 'no' },
    avatar: String,
    // New comprehensive health fields
    activityLevel: {
      type: String,
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'moderate', 'very_active', 'extremely_active']
      // optional - no default, left unset until the user completes onboarding
    },
    // Onboarding "What matters to you?" goals (pick up to 3), plus free-text "Other"
    goals: {
      type: [String],
      enum: [
        'Better Sleep', 'Improve Energy', 'Weight Management', 'Build Muscle',
        'Better Nutrition', 'Reduce Stress', 'Healthy Ageing', 'Understand My Health',
        'Manage Diabetes', 'Heart Health', 'Boost Immunity', 'Improve Overall Wellness', 'Other'
      ],
      default: undefined // optional - omit the key entirely rather than defaulting to []
    },
    goalOther: { type: String, trim: true }, // free-text when 'Other' is selected in goals
    // Onboarding "Any existing health conditions?" multi-select, plus free-text "Other"
    healthConditions: {
      type: [String],
      enum: [
        'Diabetes', 'Hypertension', 'High Cholesterol', 'Thyroid', 'PCOS',
        'Vitamin Deficiency', 'Gut Health Issues', 'Heart Disease', 'None of these', 'Other'
      ],
      default: undefined // optional
    },
    healthConditionOther: { type: String, trim: true }, // free-text when 'Other' is selected in healthConditions
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
      sleepHours: { type: Number, min: 0, max: 24 }, // hrs per day
      stressLevel: { type: String, enum: ['low', 'moderate', 'high'] },
      waterIntake: { type: Number, min: 0 }, // glasses per day (goal) — falls back to 8 in code if unset
      waterGlassSizeMl: { type: Number, min: 50, max: 2000, default: 250 }, // ml per glass, user-configurable
      stepGoal: { type: Number, min: 1000, max: 50000, default: 10000 },
      sleepGoalHours: { type: Number, min: 4, max: 12, default: 8 }
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
      hba1c: { type: Number, min: 0, max: 20 }, // HbA1c percentage
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
    // Free-form on purpose: an enum of Indian states would reject every user
    // outside India, and `country` is already free-form. Trimmed so a stray
    // space can't produce "Kerala " and "Kerala" as distinct values.
    state: { type: String, trim: true, default: null },
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

// ---------------------------------------------------------------------------
// Keep the `protect` middleware's user cache honest.
//
// utils/userCache holds each user for a short TTL so auth doesn't hit Mongo on
// every request. Invalidating at each of the ~70 places that write a User would
// be forgotten the first time someone adds a new one, so it happens here
// instead: any write through this model drops the cached copy.
//
// Not covered: updateMany and bulk writes, which don't expose the affected ids.
// Those are admin/cron paths where a <30s stale read is acceptable; call
// userCache.clear() explicitly if you add one where it isn't.
// ---------------------------------------------------------------------------
const userCache = require('../utils/userCache');

userSchema.post('save', function (doc) {
  if (doc?._id) userCache.invalidate(doc._id);
});

userSchema.post(
  ['findOneAndUpdate', 'findOneAndDelete', 'findOneAndReplace'],
  function (doc) {
    // Only populated when the query returns the doc; fall back to the filter.
    const id = doc?._id ?? this.getQuery?.()?._id;
    if (id) userCache.invalidate(id);
  }
);

userSchema.post(
  ['updateOne', 'deleteOne', 'replaceOne'],
  { query: true, document: false },
  function () {
    const id = this.getQuery?.()?._id;
    if (id) userCache.invalidate(id);
  }
);

module.exports = mongoose.model('User', userSchema);
