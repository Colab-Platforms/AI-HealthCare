const mongoose = require('mongoose');

const foodAdulterationSchema = new mongoose.Schema({
  foodName: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  adulterants: [{
    type: String
  }],
  homeTests: [{
    type: String
  }],
  healthRisks: [{
    type: String
  }],
  officialSources: [{
    name: String,
    url: String,
    date: Date
  }],
  lastUpdated: {
    type: Date,
    default: Date.now
  },
  aiSummary: String,
  safetyScore: {
    type: Number,
    min: 0,
    max: 100,
    default: 100
  },
  isAlertActive: {
    type: Boolean,
    default: false
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('FoodAdulteration', foodAdulterationSchema);
