const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  phone: { type: String, sparse: true },
  password: { type: String, required: true, minlength: 6 },
  role: { type: String, enum: ['patient', 'client', 'doctor', 'admin'], default: 'patient' },
  isActive: { type: Boolean, default: true },
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
    avatar: String,
    // New comprehensive health fields
    activityLevel: { 
      type: String, 
      enum: ['sedentary', 'lightly_active', 'moderately_active', 'very_active', 'extremely_active'],
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
    }
  },
  nutritionGoal: {
    goal: { 
      type: String, 
      enum: ['weight_loss', 'weight_gain', 'muscle_gain', 'maintain', 'general_health'],
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
    type: Map,
    of: {
      type: Map,
      of: Boolean
    },
    default: {}
  },
  streakDays: { type: Number, default: 0 }
}, { timestamps: true });

userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

userSchema.methods.comparePassword = async function(candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

module.exports = mongoose.model('User', userSchema);
