const mongoose = require('mongoose');

const nutritionSchema = new mongoose.Schema({
  calories: { type: Number, required: true },
  protein: { type: Number, required: true }, // grams
  carbs: { type: Number, required: true }, // grams
  fats: { type: Number, required: true }, // grams
  fiber: { type: Number, default: 0 }, // grams
  sugar: { type: Number, default: 0 }, // grams
  sodium: { type: Number, default: 0 }, // mg
  vitamins: {
    vitaminA: { type: Number, default: 0 },
    vitaminC: { type: Number, default: 0 },
    vitaminD: { type: Number, default: 0 },
    vitaminB12: { type: Number, default: 0 },
    iron: { type: Number, default: 0 },
    calcium: { type: Number, default: 0 }
  }
});

const foodItemSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  quantity: String, // e.g., "1 cup", "150g", "2 pieces"
  nutrition: nutritionSchema
});

const foodLogSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true
  },
  mealType: {
    type: String,
    enum: ['breakfast', 'lunch', 'dinner', 'snack'],
    required: true
  },
  foodItems: [foodItemSchema],
  totalNutrition: nutritionSchema,
  healthScore: {
    type: Number,
    min: 0,
    max: 100
  },
  healthScore10: {
    type: Number,
    min: 0,
    max: 10
  },
  micronutrients: [{
    name: String,
    value: String,
    percentage: Number
  }],
  enhancementTips: [{
    name: String,
    benefit: String
  }],
  healthBenefitsSummary: String,
  imageUrl: String, // Cloudinary or base64
  aiAnalysis: String, // Full AI response
  notes: String,
  timestamp: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Index for querying user's food logs by date
foodLogSchema.index({ userId: 1, timestamp: -1 });

// Calculate total nutrition before saving
foodLogSchema.pre('save', function (next) {
  if (this.foodItems && this.foodItems.length > 0) {
    const total = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0,
      vitamins: {
        vitaminA: 0,
        vitaminC: 0,
        vitaminD: 0,
        vitaminB12: 0,
        iron: 0,
        calcium: 0
      }
    };

    this.foodItems.forEach(item => {
      if (item.nutrition) {
        total.calories += item.nutrition.calories || 0;
        total.protein += item.nutrition.protein || 0;
        total.carbs += item.nutrition.carbs || 0;
        total.fats += item.nutrition.fats || 0;
        total.fiber += item.nutrition.fiber || 0;
        total.sugar += item.nutrition.sugar || 0;
        total.sodium += item.nutrition.sodium || 0;

        if (item.nutrition.vitamins) {
          total.vitamins.vitaminA += item.nutrition.vitamins.vitaminA || 0;
          total.vitamins.vitaminC += item.nutrition.vitamins.vitaminC || 0;
          total.vitamins.vitaminD += item.nutrition.vitamins.vitaminD || 0;
          total.vitamins.vitaminB12 += item.nutrition.vitamins.vitaminB12 || 0;
          total.vitamins.iron += item.nutrition.vitamins.iron || 0;
          total.vitamins.calcium += item.nutrition.vitamins.calcium || 0;
        }
      }
    });

    this.totalNutrition = total;
  }
  next();
});

module.exports = mongoose.model('FoodLog', foodLogSchema);
