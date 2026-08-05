const mongoose = require('mongoose');

const healthGoalSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  goalType: {
    type: String,
    enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'maintenance', 'health_improvement', 'general_health', 'disease_management'],
    required: true
  },
  currentWeight: {
    type: Number,
    required: true,
    min: [30, 'Weight must be at least 30kg'],
    max: [300, 'Weight must be less than 300kg']
  },
  targetWeight: {
    type: Number,
    required: true,
    min: [30, 'Target weight must be at least 30kg'],
    max: [300, 'Weight must be less than 300kg']
  },
  height: {
    type: Number, // in cm
    required: true,
    min: [100, 'Height must be at least 100cm'],
    max: [250, 'Height must be less than 250cm']
  },
  age: {
    type: Number,
    required: true,
    min: [1, 'Age must be at least 1'],
    max: [120, 'Age must be less than 120']
  },
  gender: {
    type: String,
    enum: ['male', 'female', 'other'],
    required: true
  },
  activityLevel: {
    type: String,
    enum: ['sedentary', 'lightly_active', 'moderately_active', 'moderate', 'very_active', 'extremely_active'],
    default: 'sedentary'
  },
  targetDate: Date,

  // Calculated values
  bmr: Number, // Basal Metabolic Rate
  tdee: Number, // Total Daily Energy Expenditure
  dailyCalorieTarget: Number,
  // The actual weekly weight-change rate (kg) used to derive dailyCalorieTarget, AFTER capping
  // to a physiologically realistic max — lets the UI tell the user their real ETA vs. what they asked for
  weeklyRateKg: Number,
  // Manual calorie override: when set, dailyCalorieTarget uses this value instead of the
  // calculateCalorieTarget() formula. Reset to 'auto' whenever the user resubmits the goal
  // form (goalType/targetWeight/timeframe/etc.) — auto-calc always wins over a stale override.
  calorieSource: {
    type: String,
    enum: ['auto', 'manual'],
    default: 'auto'
  },
  manualCalorieTarget: Number,

  macroTargets: {
    protein: Number, // grams
    carbs: Number, // grams
    fats: Number // grams
  },

  // Progress tracking
  startWeight: Number,
  startDate: {
    type: Date,
    default: Date.now
  },
  weeklyWeightLogs: [{
    weight: Number,
    date: Date,
    notes: String
  }],

  // Preferences
  dietaryPreference: {
    type: String,
    enum: ['vegetarian', 'vegan', 'non-vegetarian', 'eggetarian', 'paleo', 'keto', 'other'],
    default: 'non-vegetarian'
  },
  allergies: [String],
  dislikedFoods: [String],

  isActive: {
    type: Boolean,
    default: true
  },
  isDiabetic: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

// Calculate BMR using Mifflin-St Jeor Equation
healthGoalSchema.methods.calculateBMR = function () {
  if (this.gender === 'male') {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) + 5;
  } else {
    this.bmr = (10 * this.currentWeight) + (6.25 * this.height) - (5 * this.age) - 161;
  }
  return this.bmr;
};

// Calculate TDEE based on activity level
healthGoalSchema.methods.calculateTDEE = function () {
  const activityMultipliers = {
    sedentary: 1.2,
    lightly_active: 1.375,
    moderately_active: 1.55,
    moderate: 1.55,
    very_active: 1.725,
    extremely_active: 1.9
  };

  if (!this.bmr) {
    this.calculateBMR();
  }

  this.tdee = this.bmr * activityMultipliers[this.activityLevel];
  return this.tdee;
};

// Max safe weekly rate of weight change, as a fraction of current bodyweight.
// weight_loss: ACSM/CDC safe-loss guideline (~1%/week). weight_gain: general bulk cap (~0.5%/week).
// muscle_gain: natural muscle-protein-synthesis ceiling is far lower than fat loss/gain rates —
// sports-nutrition literature (Aragon/Helms lean-gain models) puts it around 0.25%/week; surplus
// beyond what the body can actually turn into muscle just becomes fat, so we don't let a user's
// requested timeframe push the surplus past this regardless of how fast they say they want to go.
const MAX_WEEKLY_RATE_FRACTION = {
  weight_loss: 0.01,
  weight_gain: 0.005,
  muscle_gain: 0.0025,
};
const KCAL_PER_KG_FAT = 7700; // Wishnofsky rule — standard energy-density-of-fat approximation

// Calculate daily calorie target based on goal (scientifically backed)
healthGoalSchema.methods.calculateCalorieTarget = function () {
  if (!this.tdee) {
    this.calculateTDEE();
  }

  let calorieAdjust = 0;
  this.weeklyRateKg = 0; // what we actually targeted after clamping — surfaced to the UI

  const hasWeightGoal = ['weight_loss', 'weight_gain', 'muscle_gain'].includes(this.goalType);

  if (hasWeightGoal && this.targetWeight && this.currentWeight) {
    // Derive the rate the user is IMPLICITLY asking for from targetWeight + targetDate,
    // instead of using a flat constant that ignores both entirely.
    const weeksAvailable = this.targetDate
      ? Math.max(1, (new Date(this.targetDate) - Date.now()) / (7 * 24 * 60 * 60 * 1000))
      : 12; // sane default when no timeframe was given

    const requestedWeeklyRate = (this.targetWeight - this.currentWeight) / weeksAvailable;

    // The safety cap always follows the DIRECTION actually implied by target vs. current
    // weight, not the selected goalType label. Previously a mismatched label (e.g. "weight_loss"
    // with a higher target weight) forced the rate's sign to match the label, which clamped it
    // to exactly 0 — freezing the calorie budget at plain maintenance regardless of target
    // weight or timeframe. The mismatch is still flagged to the user elsewhere in the UI, but
    // the calorie math itself must always track their actual numbers.
    const maxRateFraction = requestedWeeklyRate < 0
      ? MAX_WEEKLY_RATE_FRACTION.weight_loss
      : (this.goalType === 'muscle_gain' ? MAX_WEEKLY_RATE_FRACTION.muscle_gain : MAX_WEEKLY_RATE_FRACTION.weight_gain);
    const maxRate = maxRateFraction * this.currentWeight;

    const cappedWeeklyRate = requestedWeeklyRate < 0
      ? Math.max(requestedWeeklyRate, -maxRate)
      : Math.min(requestedWeeklyRate, maxRate);

    this.weeklyRateKg = Math.round(cappedWeeklyRate * 100) / 100;
    calorieAdjust = (cappedWeeklyRate * KCAL_PER_KG_FAT) / 7;

    // Diabetic users get a gentler adjustment for glycemic/metabolic safety margin
    if (this.isDiabetic) calorieAdjust *= 0.8;
  } else {
    // No targetWeight/timeframe given — fall back to conservative flat defaults
    switch (this.goalType) {
      case 'weight_loss':
        calorieAdjust = this.isDiabetic ? -400 : -500;
        break;
      case 'weight_gain':
        calorieAdjust = this.isDiabetic ? 250 : 500;
        break;
      case 'muscle_gain':
        calorieAdjust = this.isDiabetic ? 200 : 300;
        break;
      default:
        calorieAdjust = 0;
    }
  }

  // Safety floor: never below ~1200/1500 kcal (standard nutrition-guideline minimums) or
  // below 1.1x BMR — deficits beyond this are considered unsafe without medical supervision.
  const safeMinimum = Math.max(this.gender === 'male' ? 1500 : 1200, Math.round(this.bmr * 1.1));
  this.dailyCalorieTarget = Math.max(Math.round(this.tdee + calorieAdjust), safeMinimum);
  return this.dailyCalorieTarget;
};

// Calculate macro targets (adjusted for realistic intake)
healthGoalSchema.methods.calculateMacros = function () {
  if (!this.dailyCalorieTarget) {
    this.calculateCalorieTarget();
  }

  // --- DIABETIC USERS: Clinically safe macro split ---
  // Diabetics need strictly controlled carbs (130-150g/day max),
  // adequate protein, and moderate healthy fats.
  if (this.isDiabetic) {
    let proteinPct, carbPct, fatPct;

    switch (this.goalType) {
      case 'weight_loss':
        proteinPct = 0.35; // High protein for satiety + muscle preservation
        carbPct = 0.25;    // Strict carb control for blood sugar
        fatPct = 0.40;     // Moderate healthy fats
        break;
      case 'muscle_gain':
        proteinPct = 0.35; // High protein for muscle synthesis
        carbPct = 0.25;    // Controlled carbs
        fatPct = 0.40;     // Moderate fats
        break;
      case 'weight_gain':
        proteinPct = 0.30; // Good protein for lean mass
        carbPct = 0.25;    // Controlled carbs (~130g for safety)
        fatPct = 0.45;     // Healthy fats for caloric surplus
        break;
      default: // maintenance, general_health, disease_management
        proteinPct = 0.30;
        carbPct = 0.25;
        fatPct = 0.45;
        break;
    }

    this.macroTargets = {
      protein: Math.round((this.dailyCalorieTarget * proteinPct) / 4),
      carbs: Math.round((this.dailyCalorieTarget * carbPct) / 4),
      fats: Math.round((this.dailyCalorieTarget * fatPct) / 9)
    };

    return this.macroTargets;
  }

  // --- NON-DIABETIC USERS: Per-kg body weight approach ---
  let proteinPerKg = 1.2;
  let fatPerKg = 0.8;

  switch (this.goalType) {
    case 'weight_loss':
      proteinPerKg = 1.6;
      fatPerKg = 0.6;
      break;
    case 'muscle_gain':
      proteinPerKg = 1.8;
      fatPerKg = 0.8;
      break;
    case 'weight_gain':
      proteinPerKg = 1.4;
      fatPerKg = 1.0;
      break;
    default:
      proteinPerKg = 1.2;
      fatPerKg = 0.8;
      break;
  }

  let protein = Math.round(this.currentWeight * proteinPerKg);
  let fats = Math.round(this.currentWeight * fatPerKg);

  // Safety cap for extremely large weights
  const maxProtein = Math.round((this.dailyCalorieTarget * 0.35) / 4);
  protein = Math.min(protein, maxProtein, 250);

  const proteinCalories = protein * 4;
  const fatsCalories = fats * 9;

  let remainingCalories = this.dailyCalorieTarget - proteinCalories - fatsCalories;

  // If baseline calories drop too low, re-adjust fats
  if (remainingCalories < 400) {
    fats = Math.max(Math.round((this.dailyCalorieTarget * 0.2) / 9), 30);
    remainingCalories = this.dailyCalorieTarget - proteinCalories - (fats * 9);
  }

  const carbs = Math.round(Math.max(remainingCalories / 4, 0));

  this.macroTargets = {
    protein: protein,
    carbs: carbs,
    fats: fats
  };

  return this.macroTargets;
};

// Calculate all targets before saving
healthGoalSchema.pre('save', function (next) {
  if (!this.startWeight) {
    this.startWeight = this.currentWeight;
  }

  this.calculateBMR();
  this.calculateTDEE();

  if (this.calorieSource === 'manual' && this.manualCalorieTarget) {
    this.dailyCalorieTarget = this.manualCalorieTarget;
    this.weeklyRateKg = null; // no longer derived from the formula
  } else {
    this.calculateCalorieTarget();
  }

  this.calculateMacros(); // macro split still derives from dailyCalorieTarget either way

  next();
});

healthGoalSchema.index({ userId: 1, isActive: 1 }); // fetch active goal per user

module.exports = mongoose.model('HealthGoal', healthGoalSchema);
