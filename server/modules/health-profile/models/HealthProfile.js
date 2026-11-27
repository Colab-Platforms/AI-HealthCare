const mongoose = require('mongoose');

// One HealthProfile per user: the master copy of who the user is health-wise
// (slow-changing facts). Daily/time-series data (wearables, food logs, labs,
// symptoms) stays in its own models and is NOT stored here.
//
// Only ProfileWriteService writes this collection. It also keeps the legacy
// User.profile health fields in sync as a mirror, in the same transaction.

const SOURCES = ['manual', 'device', 'report', 'chat', 'migration'];

// Provenance carried by every list item and every scalar section.
const provenance = {
    source: { type: String, enum: SOURCES, required: true },
    verified: { type: Boolean, default: true }, // false = AI-extracted, not yet confirmed by the user
    updatedAt: { type: Date, default: Date.now },
};
const metaSchema = new mongoose.Schema(provenance, { _id: false });

// A list is "missing" (never asked), "none" (user said none) or "has_items".
// Keeping none separate from missing stops the coach asking the same question again.
const LIST_STATES = ['missing', 'none', 'has_items'];
const listOf = (itemSchema) => ({
    state: { type: String, enum: LIST_STATES, default: 'missing' },
    items: { type: [itemSchema], default: [] },
});
const item = (fields) => new mongoose.Schema({ ...fields, ...provenance }); // items keep _id for edit/delete

const conditionSchema = item({
    name: { type: String, required: true, trim: true },
    status: { type: String, enum: ['active', 'controlled', 'resolved', 'unknown'], default: 'unknown' },
    diagnosedYear: { type: Number, min: 1900, max: 2100 },
});

const medicationSchema = item({
    name: { type: String, required: true, trim: true },
    dose: { type: String, trim: true },        // as the user said it, e.g. "500mg"
    frequency: { type: String, trim: true },   // e.g. "twice_daily"
    since: { type: Date },
    active: { type: Boolean, default: true },
});

const allergySchema = item({
    allergen: { type: String, required: true, trim: true },
    type: { type: String, enum: ['food', 'drug', 'other', 'unknown'], default: 'unknown' },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'unknown'], default: 'unknown' },
    reaction: { type: String, trim: true },
});

const surgerySchema = item({
    name: { type: String, required: true, trim: true },
    year: { type: Number, min: 1900, max: 2100 },
    bodyPart: { type: String, trim: true },
});

const familyHistorySchema = item({
    relation: { type: String, trim: true },
    condition: { type: String, required: true, trim: true },
});

// Food intolerances (26 Nov): not allergies (no immune reaction) but they still
// decide what a meal plan may contain ("lactose": no milk / paneer unless lactose-free).
const intoleranceSchema = item({
    name: { type: String, required: true, trim: true },        // e.g. "lactose", "gluten", "spicy food"
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'unknown'], default: 'unknown' },
    reaction: { type: String, trim: true },                    // e.g. "bloating", "acidity"
});

// Mental health (26 Nov): handled gently by the coach; never diagnosed by it.
const mentalHealthSchema = item({
    name: { type: String, required: true, trim: true },        // as the user says it, e.g. "anxiety", "depression"
    status: { type: String, enum: ['active', 'managed', 'past', 'unknown'], default: 'unknown' },
    treatment: { type: String, enum: ['none', 'therapy', 'medication', 'both', 'unknown'], default: 'unknown' },
    since: { type: Number, min: 1900, max: 2100 },             // year
});

// Physical disabilities (26 Nov): what the user lives with long term, so
// exercise / activity / meal advice fits them ("uses a wheelchair": no step
// targets as such, chair exercises; "low vision": no app-only cues).
const disabilitySchema = item({
    name: { type: String, required: true, trim: true },        // as the user says it, e.g. "left leg amputation"
    area: { type: String, enum: ['mobility', 'vision', 'hearing', 'speech', 'upper_limb', 'lower_limb', 'spine', 'other'], default: 'other' },
    severity: { type: String, enum: ['mild', 'moderate', 'severe', 'unknown'], default: 'unknown' },
    aid: { type: String, trim: true },                         // e.g. "wheelchair", "walker", "prosthetic leg", "hearing aid"
    notes: { type: String, trim: true },
});

const healthProfileSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

    basic: {
        dateOfBirth: Date,
        age: { type: Number, min: 0, max: 120 }, // kept because onboarding may send age without DOB
        gender: { type: String, enum: ['male', 'female', 'other'] },
        bloodGroup: String,
        city: String,
        state: String,
        country: String,
        language: String,
        meta: metaSchema,
    },

    body: {
        heightCm: { type: Number, min: 0, max: 300 },
        weightKg: { type: Number, min: 0, max: 500 },
        waistCm: { type: Number, min: 0, max: 300 },
        bodyFatPct: { type: Number, min: 0, max: 100 },
        meta: metaSchema,
    },

    conditions: listOf(conditionSchema),
    medications: listOf(medicationSchema),
    allergies: listOf(allergySchema),
    surgeries: listOf(surgerySchema),
    familyHistory: listOf(familyHistorySchema),
    disabilities: listOf(disabilitySchema),
    intolerances: listOf(intoleranceSchema),
    mentalHealth: listOf(mentalHealthSchema),

    lifestyle: {
        // 'no' = not currently (legacy boolean false); never/former only when the user says so
        smoking: { type: String, enum: ['no', 'never', 'former', 'current'] },
        smokingFrequency: String,
        alcohol: { type: String, enum: ['no', 'never', 'former', 'current'] },
        alcoholFrequency: String,
        profession: { type: String, enum: ['desk_job', 'physically_active_job', 'mixed', 'other'] },
        workShift: { type: String, enum: ['day', 'night', 'rotating', 'other'] },
        activityLevel: String,
        sleepHours: { type: Number, min: 0, max: 24 },
        stressLevel: { type: String, enum: ['low', 'moderate', 'high'] },
        meta: metaSchema,
    },

    diet: {
        preference: { type: String, enum: ['vegetarian', 'non-vegetarian', 'vegan', 'eggetarian', 'jain', 'other'] },
        region: String,
        likes: [String],
        dislikes: [String],
        // from the app's diet preferences screen (was User.profile.dietPreferences)
        cuisinePreference: String,
        mealsPerDay: String,
        restrictions: [String],
        // from the food preferences screen (was User.foodPreferences); likes = preferredFoods,
        // dislikes = foodsToAvoid (incl. dishes rejected in the diet plan), region above
        dietaryRestrictions: [String], // allergies / intolerances / religious, as the user typed them
        dietaryDo: [String],
        dietaryDont: [String],
        mealPatterns: { breakfast: [String], lunch: [String], snacks: [String], dinner: [String] },
        meta: metaSchema,
    },

    fitness: {
        experience: { type: String, enum: ['beginner', 'intermediate', 'advanced'] },
        preferredExercise: [String], // = old User.profile.fitnessProfile.exercisePreference
        equipment: [String],
        limitations: [String], // injuries / movements to avoid
        // from the app's fitness screen (was User.profile.fitnessProfile)
        primaryGoal: String,
        biggestChallenge: String,
        meta: metaSchema,
    },

    // Diabetes details (was User.profile.diabetesProfile). The condition itself
    // ("Type 2 Diabetes") stays a conditions item; this holds how it is managed.
    diabetes: {
        type: { type: String, enum: ['Type 1', 'Type 2', 'Prediabetes', 'Gestational'] },
        diagnosisYear: Number,
        status: { type: String, enum: ['Controlled', 'Uncontrolled', 'Newly diagnosed'] },
        hba1c: Number,
        glucoseMonitoring: String,
        fastingGlucose: String,
        postMealGlucose: String,
        testingFrequency: String,
        onMedication: Boolean,
        medicationType: [String],
        insulinTiming: String,
        recentDosageChange: Boolean,
        meta: metaSchema,
    },

    goals: {
        primary: [String],
        other: String,
        targetWeightKg: { type: Number, min: 0, max: 500 },
        timeline: String,
        meta: metaSchema,
    },

    coachPreferences: {
        language: String,
        answerLength: { type: String, enum: ['short', 'normal', 'detailed'] },
        checkinsEnabled: { type: Boolean, default: true },
        meta: metaSchema,
    },

    // Optimistic lock: a chat-extracted write and a user edit racing each
    // other can't silently overwrite one another.
    version: { type: Number, default: 1 },
}, { timestamps: true, collection: 'health_profiles' });

healthProfileSchema.statics.SOURCES = SOURCES;
healthProfileSchema.statics.LIST_SECTIONS = ['conditions', 'medications', 'allergies', 'surgeries', 'familyHistory', 'disabilities', 'intolerances', 'mentalHealth'];
healthProfileSchema.statics.SCALAR_SECTIONS = ['basic', 'body', 'lifestyle', 'diet', 'fitness', 'goals', 'diabetes', 'coachPreferences'];

module.exports = mongoose.models.HealthProfile || mongoose.model('HealthProfile', healthProfileSchema);
