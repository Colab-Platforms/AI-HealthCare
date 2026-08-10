const mongoose = require('mongoose');

// Versioned weights/thresholds for the Health Score engine.
// Only one document should have isActive:true at a time — the engine always
// reads the active config, so product can retune weights via DB update
// (or an admin endpoint later) without a code release. Every computed score
// stores which config version produced it (see DailyHealthScore/User.healthScore),
// so historical scores stay explainable even after weights change.
const healthScoreConfigSchema = new mongoose.Schema({
  version: { type: Number, required: true, unique: true },
  isActive: { type: Boolean, default: false },

  // Weights reflect each factor's evidence-based contribution to modifiable
  // health risk, not how easy it is to measure. Smoking is the single largest
  // modifiable mortality risk (Jha et al., NEJM 2013 — ~10 years of life
  // expectancy), so it carries its own weight rather than sharing one with
  // alcohol. Hydration, which has close to no mortality signal in healthy
  // adults, is deliberately small — it's habit-tracking, not a health measure.
  //
  // Consistency is intentionally absent here — it describes the user's
  // history, not their day, and is scored once in longTermWeights instead.
  dailyWeights: {
    sleep: { type: Number, default: 0.22 },
    nutrition: { type: Number, default: 0.21 },
    activity: { type: Number, default: 0.21 },
    smoking: { type: Number, default: 0.20 },
    alcohol: { type: Number, default: 0.11 },
    hydration: { type: Number, default: 0.05 },
  },

  longTermWeights: {
    clinical: { type: Number, default: 0.35 },
    today: { type: Number, default: 0.30 },
    consistency: { type: Number, default: 0.20 },
    trend: { type: Number, default: 0.15 },
  },

  // Minimum days of history required before a component is included —
  // below this, it's excluded and remaining weights are rescaled (avoids a
  // noisy 1-2 data-point trend/consistency masquerading as a stable number).
  minHistoryDays: {
    trend: { type: Number, default: 7 },
    consistency: { type: Number, default: 5 },
  },

  // Rolling window Consistency is measured over, in calendar days.
  consistencyWindowDays: { type: Number, default: 14 },

  // How many activities a day needs before it counts as "logged". Kept at 2,
  // not 3: a user without a wearable who doesn't track water can realistically
  // only log meals and sleep, and a threshold of 3 would score them 0%
  // consistent no matter how faithfully they logged every single day. That
  // measures how many trackers someone owns, not how regular they are.
  minComponentsForLoggedDay: { type: Number, default: 2 },

  // WHO recommends 150–300 minutes of moderate activity per week. Steps alone
  // can't tell a brisk walk from shuffling around the house, so active minutes
  // are scored alongside them where the device reports them.
  activity: {
    activeMinutesGoal: { type: Number, default: 30 },
    stepsShare: { type: Number, default: 0.6 }, // rest goes to active minutes
  },

  // Conditions that limit walking. Scoring steps for these users measures their
  // disability, not their effort, so the steps half is dropped and activity is
  // judged on active minutes alone (or skipped if the device reports neither).
  mobilityLimitedConditions: {
    type: [String],
    default: [
      'wheelchair', 'paraplegia', 'quadriplegia', 'amputation', 'amputee',
      'multiple sclerosis', 'muscular dystrophy', 'cerebral palsy',
      'severe arthritis', 'hip replacement', 'knee replacement', 'fracture',
    ],
  },

  // A lab report describes the body on the day it was taken. Counting a
  // two-year-old panel at the same strength as one from last week overstates
  // what is actually known, so its influence decays with age.
  clinicalRecency: {
    fullWeightDays: { type: Number, default: 90 },   // no decay inside this
    zeroWeightDays: { type: Number, default: 540 },  // decays linearly to the floor by here
    floor: { type: Number, default: 0.35 },          // never drops below this share
  },

  // EWMA population-to-personal blend half-life, per metric (see docs/health-score-formulas.md)
  personalBaselineTau: {
    sleep: { type: Number, default: 10 },
    steps: { type: Number, default: 10 },
    hydration: { type: Number, default: 10 },
    labMarker: { type: Number, default: 3 }, // measured in report count, not days
  },

  // The personal sleep target is blended toward the user's own average (see
  // personalBaselineTau). Left unbounded, someone who habitually sleeps 5
  // hours ends up with a 5-hour "target" and scores ~100 for chronic sleep
  // deprivation — a documented cardiovascular and metabolic risk. These bounds
  // keep the target inside the range major sleep guidance actually endorses,
  // so the score can personalise without normalising harm.
  sleepTargetBounds: {
    min: { type: Number, default: 7 },
    max: { type: Number, default: 9 },
  },

  nutritionWeights: {
    logging: { type: Number, default: 0.30 }, // credit for recording meals at all
    quality: { type: Number, default: 0.50 }, // share of logged foods rated healthy
    calories: { type: Number, default: 0.20 }, // closeness to the user's calorie goal
  },

  // Conditions where clinicians commonly prescribe fluid RESTRICTION. Pushing
  // a "drink 8 glasses" target at these users is actively unsafe, so hydration
  // is dropped from their score entirely rather than scored leniently.
  fluidRestrictedConditions: {
    type: [String],
    default: [
      'kidney disease', 'chronic kidney disease', 'ckd', 'renal failure', 'dialysis',
      'heart failure', 'congestive heart failure', 'chf', 'cirrhosis', 'liver failure',
      'hyponatremia', 'siadh', 'nephrotic syndrome',
    ],
  },

  // Relative influence of each marker family on the Clinical Score. A flat
  // average let body temperature count as much as HbA1c, and let the six
  // red-cell indices in a standard blood panel (Hb, Hct, RBC, MCV, MCH, MCHC)
  // collectively dominate — six markers all measuring one thing. Markers are
  // now collapsed to their group first, then the groups are weighted.
  markerGroups: {
    type: [{
      name: String,
      weight: Number,
      markers: [String], // matched case-insensitively against the report's marker keys
    }],
    default: [
      { name: 'glycemic', weight: 1.5, markers: ['hba1c', 'glycatedhemoglobin', 'fastingglucose', 'fastingbloodsugar', 'postprandialglucose', 'randomglucose', 'bloodsugar'] },
      { name: 'kidney', weight: 1.4, markers: ['creatinine', 'egfr', 'urea', 'bun', 'bloodureanitrogen', 'uricacid'] },
      { name: 'electrolytes', weight: 1.4, markers: ['potassium', 'sodium', 'chloride', 'calcium', 'magnesium'] },
      { name: 'lipids', weight: 1.3, markers: ['totalcholesterol', 'ldl', 'ldlcholesterol', 'hdl', 'hdlcholesterol', 'triglycerides', 'vldl'] },
      { name: 'liver', weight: 1.0, markers: ['sgpt', 'alt', 'sgot', 'ast', 'bilirubin', 'totalbilirubin', 'alkalinephosphatase', 'alp', 'albumin'] },
      { name: 'thyroid', weight: 1.0, markers: ['tsh', 't3', 't4', 'freet3', 'freet4'] },
      { name: 'redcells', weight: 1.0, markers: ['hemoglobin', 'haemoglobin', 'hematocrit', 'rbccount', 'mcv', 'mch', 'mchc', 'rdw'] },
      { name: 'plateletsWbc', weight: 1.0, markers: ['plateletcount', 'totalwbccount', 'wbccount'] },
      { name: 'vitamins', weight: 0.8, markers: ['vitamind', 'vitaminb12', 'folate', 'ferritin', 'iron'] },
      { name: 'anthropometric', weight: 0.7, markers: ['bmi', 'weight', 'waistcircumference'] },
      { name: 'differential', weight: 0.5, markers: ['neutrophils', 'lymphocytes', 'monocytes', 'eosinophils', 'basophils'] },
      { name: 'vitals', weight: 0.5, markers: ['pulserate', 'heartrate', 'bodytemperature', 'spo2', 'respiratoryrate'] },
    ],
  },

  // Values here are outside the range where a score is meaningful — they need
  // a doctor, not a number. A flat average buries them: one critical potassium
  // among forty normal markers still averages to ~89, which reads as
  // reassurance. When any of these is breached the score is capped and an
  // explicit alert is surfaced instead. Ranges follow common lab critical-value
  // ("panic value") conventions; units are as reported by the analyser.
  // `plausibleMin`/`plausibleMax` bound the whole physiologically possible
  // span in the stated unit. Labs report the same result in different units —
  // platelets as "2.4 lakh/µL" or "240000/µL", haemoglobin as g/dL or g/L —
  // and comparing a raw number against thresholds written for one unit turns a
  // perfectly healthy result into a critical alert. A value outside the
  // plausible span is a unit mismatch, not a dying patient, so detection is
  // skipped for it. False alarms here are their own harm: they cause panic and,
  // repeated, teach users to ignore the alert that actually matters.
  criticalMarkerRanges: {
    type: [{
      marker: String,
      low: Number,   // at or below → critical
      high: Number,  // at or above → critical
      plausibleMin: Number,
      plausibleMax: Number,
      unit: String,
      label: String,
    }],
    default: [
      { marker: 'potassium', low: 2.8, high: 6.2, plausibleMin: 1, plausibleMax: 10, unit: 'mmol/L', label: 'Potassium' },
      { marker: 'sodium', low: 120, high: 158, plausibleMin: 95, plausibleMax: 200, unit: 'mmol/L', label: 'Sodium' },
      { marker: 'calcium', low: 6.5, high: 13, plausibleMin: 3, plausibleMax: 20, unit: 'mg/dL', label: 'Calcium' },
      { marker: 'fastingglucose', low: 50, high: 400, plausibleMin: 15, plausibleMax: 900, unit: 'mg/dL', label: 'Blood sugar' },
      { marker: 'bloodsugar', low: 50, high: 400, plausibleMin: 15, plausibleMax: 900, unit: 'mg/dL', label: 'Blood sugar' },
      { marker: 'hba1c', low: null, high: 10, plausibleMin: 2, plausibleMax: 20, unit: '%', label: 'HbA1c' },
      { marker: 'hemoglobin', low: 7, high: 20, plausibleMin: 2, plausibleMax: 25, unit: 'g/dL', label: 'Haemoglobin' },
      { marker: 'haemoglobin', low: 7, high: 20, plausibleMin: 2, plausibleMax: 25, unit: 'g/dL', label: 'Haemoglobin' },
      { marker: 'plateletcount', low: 0.5, high: 10, plausibleMin: 0.05, plausibleMax: 30, unit: 'lakh/µL', label: 'Platelets' },
      { marker: 'totalwbccount', low: 2000, high: 30000, plausibleMin: 100, plausibleMax: 500000, unit: '/µL', label: 'White cell count' },
      { marker: 'creatinine', low: null, high: 4, plausibleMin: 0.1, plausibleMax: 25, unit: 'mg/dL', label: 'Creatinine' },
      { marker: 'egfr', low: 15, high: null, plausibleMin: 1, plausibleMax: 200, unit: 'mL/min', label: 'Kidney function (eGFR)' },
      { marker: 'spo2', low: 90, high: null, plausibleMin: 40, plausibleMax: 100, unit: '%', label: 'Oxygen saturation' },
      { marker: 'bloodpressuresystolic', low: 80, high: 180, plausibleMin: 40, plausibleMax: 300, unit: 'mmHg', label: 'Systolic blood pressure' },
      { marker: 'bloodpressurediastolic', low: 50, high: 120, plausibleMin: 20, plausibleMax: 200, unit: 'mmHg', label: 'Diastolic blood pressure' },
    ],
  },

  // Ceiling applied to the Overall Score when a critical value is present, so
  // the number can never read as reassurance while something needs attention.
  criticalFindingScoreCap: { type: Number, default: 45 },

  riskAdjustment: {
    floor: { type: Number, default: 0.6 }, // score can never be derated below this fraction
    severityWeights: {
      mild: { type: Number, default: 0.05 },
      moderate: { type: Number, default: 0.15 },
      severe: { type: Number, default: 0.3 },
    },
  },

  bloodPressureCategories: {
    // Ordered worst-to-best is not required; scorer picks by threshold match.
    // "worse of systolic/diastolic category wins" — see healthScoreService.js
    type: [{
      name: String,
      maxSystolic: Number,
      maxDiastolic: Number,
      score: Number,
    }],
    default: [
      { name: 'normal', maxSystolic: 119, maxDiastolic: 79, score: 100 },
      { name: 'elevated', maxSystolic: 129, maxDiastolic: 79, score: 85 },
      { name: 'stage1', maxSystolic: 139, maxDiastolic: 89, score: 60 },
      { name: 'stage2', maxSystolic: 179, maxDiastolic: 119, score: 35 },
      { name: 'crisis', maxSystolic: Infinity, maxDiastolic: Infinity, score: 10 },
    ],
  },
}, { timestamps: true });

module.exports = mongoose.model('HealthScoreConfig', healthScoreConfigSchema);
