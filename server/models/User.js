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
    height: Number,
    weight: Number,
    bloodGroup: String,
    allergies: [String],
    chronicConditions: [String],
    avatar: String
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
  }
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
