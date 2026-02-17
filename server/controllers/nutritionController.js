const FoodLog = require('../models/FoodLog');
const HealthGoal = require('../models/HealthGoal');
const NutritionSummary = require('../models/NutritionSummary');
const nutritionAI = require('../services/nutritionAI');

// Analyze food from image or text
exports.analyzeFood = async (req, res) => {
  try {
    const { foodDescription, imageBase64, additionalContext } = req.body;

    if (!foodDescription && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide either a food description or image'
      });
    }

    let analysis;
    
    if (imageBase64) {
      // Analyze from image
      analysis = await nutritionAI.analyzeFromImage(imageBase64, additionalContext);
    } else {
      // Analyze from text
      analysis = await nutritionAI.analyzeFromText(foodDescription);
    }

    res.json({
      success: true,
      analysis: analysis.data,
      message: 'Food analyzed successfully'
    });
  } catch (error) {
    console.error('Analyze food error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze food',
      error: error.message
    });
  }
};

// Log a meal
exports.logMeal = async (req, res) => {
  try {
    const { mealType, foodItems, imageUrl, notes, timestamp } = req.body;

    if (!mealType || !foodItems || foodItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Meal type and food items are required'
      });
    }

    const foodLog = new FoodLog({
      userId: req.user._id,
      mealType,
      foodItems,
      imageUrl,
      notes,
      timestamp: timestamp || new Date()
    });

    await foodLog.save();

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      foodLog,
      message: 'Meal logged successfully'
    });
  } catch (error) {
    console.error('Log meal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log meal',
      error: error.message
    });
  }
};

// Get food logs
exports.getFoodLogs = async (req, res) => {
  try {
    const { startDate, endDate, mealType } = req.query;

    const query = { userId: req.user._id };

    if (startDate || endDate) {
      query.timestamp = {};
      if (startDate) query.timestamp.$gte = new Date(startDate);
      if (endDate) query.timestamp.$lte = new Date(endDate);
    }

    if (mealType) {
      query.mealType = mealType;
    }

    const foodLogs = await FoodLog.find(query)
      .sort({ timestamp: -1 })
      .limit(100);

    res.json({
      success: true,
      foodLogs,
      count: foodLogs.length
    });
  } catch (error) {
    console.error('Get food logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food logs',
      error: error.message
    });
  }
};

// Get today's food logs
exports.getTodayLogs = async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    const foodLogs = await FoodLog.find({
      userId: req.user._id,
      timestamp: {
        $gte: today,
        $lt: tomorrow
      }
    }).sort({ timestamp: 1 });

    res.json({
      success: true,
      foodLogs,
      count: foodLogs.length
    });
  } catch (error) {
    console.error('Get today logs error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get today\'s logs',
      error: error.message
    });
  }
};

// Update food log
exports.updateFoodLog = async (req, res) => {
  try {
    const { id } = req.params;
    const updates = req.body;

    const foodLog = await FoodLog.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!foodLog) {
      return res.status(404).json({
        success: false,
        message: 'Food log not found'
      });
    }

    Object.assign(foodLog, updates);
    await foodLog.save();

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      foodLog,
      message: 'Food log updated successfully'
    });
  } catch (error) {
    console.error('Update food log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to update food log',
      error: error.message
    });
  }
};

// Delete food log
exports.deleteFoodLog = async (req, res) => {
  try {
    const { id } = req.params;

    const foodLog = await FoodLog.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!foodLog) {
      return res.status(404).json({
        success: false,
        message: 'Food log not found'
      });
    }

    // Update daily summary
    await updateDailySummary(req.user._id, foodLog.timestamp);

    res.json({
      success: true,
      message: 'Food log deleted successfully'
    });
  } catch (error) {
    console.error('Delete food log error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete food log',
      error: error.message
    });
  }
};

// Set health goal
exports.setHealthGoal = async (req, res) => {
  try {
    const goalData = {
      ...req.body,
      userId: req.user._id
    };

    let healthGoal = await HealthGoal.findOne({ userId: req.user._id });

    if (healthGoal) {
      // Update existing goal
      Object.assign(healthGoal, goalData);
    } else {
      // Create new goal
      healthGoal = new HealthGoal(goalData);
    }

    await healthGoal.save();

    res.json({
      success: true,
      healthGoal,
      message: 'Health goal set successfully'
    });
  } catch (error) {
    console.error('Set health goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to set health goal',
      error: error.message
    });
  }
};

// Get health goal
exports.getHealthGoal = async (req, res) => {
  try {
    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });

    if (!healthGoal) {
      return res.status(404).json({
        success: false,
        message: 'No health goal found. Please set your goals first.'
      });
    }

    res.json({
      success: true,
      healthGoal
    });
  } catch (error) {
    console.error('Get health goal error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get health goal',
      error: error.message
    });
  }
};

// Log weight
exports.logWeight = async (req, res) => {
  try {
    const { weight, notes } = req.body;

    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });

    if (!healthGoal) {
      return res.status(404).json({
        success: false,
        message: 'Please set your health goal first'
      });
    }

    healthGoal.currentWeight = weight;
    healthGoal.weeklyWeightLogs.push({
      weight,
      date: new Date(),
      notes
    });

    // Recalculate targets based on new weight
    await healthGoal.save();

    res.json({
      success: true,
      healthGoal,
      message: 'Weight logged successfully'
    });
  } catch (error) {
    console.error('Log weight error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to log weight',
      error: error.message
    });
  }
};

// Get daily nutrition summary
exports.getDailySummary = async (req, res) => {
  try {
    const { date } = req.query;
    const targetDate = date ? new Date(date) : new Date();
    targetDate.setHours(0, 0, 0, 0);

    let summary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: targetDate
    });

    if (!summary) {
      // Create summary if doesn't exist
      summary = await createDailySummary(req.user._id, targetDate);
    }

    res.json({
      success: true,
      summary
    });
  } catch (error) {
    console.error('Get daily summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get daily summary',
      error: error.message
    });
  }
};

// Get weekly summary
exports.getWeeklySummary = async (req, res) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const summaries = await NutritionSummary.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Calculate weekly averages
    const weeklyStats = {
      avgCalories: 0,
      avgProtein: 0,
      avgCarbs: 0,
      avgFats: 0,
      daysLogged: summaries.length,
      dailySummaries: summaries
    };

    if (summaries.length > 0) {
      summaries.forEach(summary => {
        weeklyStats.avgCalories += summary.totalCalories;
        weeklyStats.avgProtein += summary.totalProtein;
        weeklyStats.avgCarbs += summary.totalCarbs;
        weeklyStats.avgFats += summary.totalFats;
      });

      weeklyStats.avgCalories = Math.round(weeklyStats.avgCalories / summaries.length);
      weeklyStats.avgProtein = Math.round(weeklyStats.avgProtein / summaries.length);
      weeklyStats.avgCarbs = Math.round(weeklyStats.avgCarbs / summaries.length);
      weeklyStats.avgFats = Math.round(weeklyStats.avgFats / summaries.length);
    }

    res.json({
      success: true,
      weeklyStats
    });
  } catch (error) {
    console.error('Get weekly summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get last 7 days activity data for chart
exports.getActivityWeek = async (req, res) => {
  try {
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const summaries = await NutritionSummary.find({
      userId: req.user._id,
      date: { $gte: startDate, $lte: endDate }
    }).sort({ date: 1 });

    // Create array with all 7 days, filling in missing days with 0 calories
    const weekData = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(date.getDate() + i);
      date.setHours(0, 0, 0, 0);
      
      const summary = summaries.find(s => {
        const sDate = new Date(s.date);
        sDate.setHours(0, 0, 0, 0);
        return sDate.getTime() === date.getTime();
      });

      weekData.push({
        date: date.toISOString().split('T')[0],
        calories: summary?.totalCalories || 0,
        protein: summary?.totalProtein || 0,
        carbs: summary?.totalCarbs || 0,
        fats: summary?.totalFats || 0
      });
    }

    res.json({
      success: true,
      weekData
    });
  } catch (error) {
    console.error('Get activity week error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get activity data',
      error: error.message
    });
  }
};

// Get meal recommendations
exports.getRecommendations = async (req, res) => {
  try {
    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });
    
    if (!healthGoal) {
      return res.status(404).json({
        success: false,
        message: 'Please set your health goal first'
      });
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    let todaySummary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: today
    });

    if (!todaySummary) {
      todaySummary = await createDailySummary(req.user._id, today);
    }

    // Get user's deficiencies from latest health report
    const User = require('../models/User');
    const user = await User.findById(req.user._id);
    const deficiencies = user.healthMetrics?.deficiencies || [];

    const recommendations = await nutritionAI.getMealRecommendations(
      healthGoal,
      todaySummary,
      deficiencies
    );

    res.json({
      success: true,
      recommendations: recommendations.data
    });
  } catch (error) {
    console.error('Get recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get recommendations',
      error: error.message
    });
  }
};

// Helper function to update daily summary
async function updateDailySummary(userId, date) {
  const targetDate = new Date(date);
  targetDate.setHours(0, 0, 0, 0);

  const nextDay = new Date(targetDate);
  nextDay.setDate(nextDay.getDate() + 1);

  // Get all food logs for the day
  const foodLogs = await FoodLog.find({
    userId,
    timestamp: {
      $gte: targetDate,
      $lt: nextDay
    }
  });

  // Calculate totals
  const totals = {
    totalCalories: 0,
    totalProtein: 0,
    totalCarbs: 0,
    totalFats: 0,
    totalFiber: 0,
    totalSugar: 0,
    totalSodium: 0
  };

  const mealsLogged = {
    breakfast: false,
    lunch: false,
    dinner: false,
    snacks: 0
  };

  foodLogs.forEach(log => {
    if (log.totalNutrition) {
      totals.totalCalories += log.totalNutrition.calories || 0;
      totals.totalProtein += log.totalNutrition.protein || 0;
      totals.totalCarbs += log.totalNutrition.carbs || 0;
      totals.totalFats += log.totalNutrition.fats || 0;
      totals.totalFiber += log.totalNutrition.fiber || 0;
      totals.totalSugar += log.totalNutrition.sugar || 0;
      totals.totalSodium += log.totalNutrition.sodium || 0;
    }

    if (log.mealType === 'snack') {
      mealsLogged.snacks++;
    } else {
      mealsLogged[log.mealType] = true;
    }
  });

  // Get user's health goal
  const healthGoal = await HealthGoal.findOne({ userId });

  let summary = await NutritionSummary.findOne({
    userId,
    date: targetDate
  });

  if (!summary) {
    summary = new NutritionSummary({
      userId,
      date: targetDate
    });
  }

  Object.assign(summary, totals);
  summary.mealsLogged = mealsLogged;

  if (healthGoal) {
    summary.calorieGoal = healthGoal.dailyCalorieTarget;
    summary.proteinGoal = healthGoal.macroTargets.protein;
    summary.carbsGoal = healthGoal.macroTargets.carbs;
    summary.fatsGoal = healthGoal.macroTargets.fats;
  }

  await summary.save();
  return summary;
}

// Helper function to create daily summary
async function createDailySummary(userId, date) {
  return await updateDailySummary(userId, date);
}

// Quick food check without logging - with complete details persistence
exports.quickFoodCheck = async (req, res) => {
  try {
    const { foodDescription, imageBase64, additionalContext } = req.body;

    console.log('Quick check request:', {
      hasDescription: !!foodDescription,
      hasImage: !!imageBase64,
      imageSize: imageBase64 ? `${(imageBase64.length * 0.75 / 1024).toFixed(2)} KB` : 'N/A'
    });

    if (!foodDescription && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a food description or image'
      });
    }

    // Check image size limit (3MB)
    if (imageBase64 && imageBase64.length > 4000000) {
      return res.status(400).json({
        success: false,
        message: 'Image too large. Please use a smaller image (max 3MB)'
      });
    }

    let analysis;
    
    // Get AI analysis
    if (imageBase64) {
      try {
        console.log('Attempting image analysis...');
        console.log('Image size:', `${(imageBase64.length * 0.75 / 1024).toFixed(2)} KB`);
        console.log('Additional context:', additionalContext);
        
        // Use image analysis
        const imageAnalysis = await nutritionAI.analyzeFromImage(imageBase64, additionalContext || foodDescription || 'Food from image');
        
        console.log('Image analysis successful');
        console.log('AI Response:', JSON.stringify(imageAnalysis.data).substring(0, 200));
        
        // Check if AI couldn't detect food
        if (imageAnalysis.data?.error === 'UNABLE_TO_DETECT_FOOD') {
          return res.status(400).json({
            success: false,
            message: imageAnalysis.data.message || 'Could not detect food in the image. Please try again with a clearer photo.',
            error: 'UNABLE_TO_DETECT_FOOD'
          });
        }
        
        // Transform image analysis to match quickFoodCheck format
        if (imageAnalysis.success && imageAnalysis.data) {
          const firstItem = imageAnalysis.data.foodItems?.[0] || {};
          const totalNutrition = imageAnalysis.data.totalNutrition || {};
          
          // Helper function to parse range values (e.g., "250-300" -> 275)
          const parseRange = (value) => {
            if (typeof value === 'string' && value.includes('-')) {
              const [min, max] = value.split('-').map(Number);
              return Math.round((min + max) / 2);
            }
            return Number(value) || 0;
          };
          
          // Helper to format range for display
          const formatRange = (value) => {
            if (typeof value === 'string' && value.includes('-')) {
              return value; // Keep as range string
            }
            return String(value);
          };
          
          // Parse nutrition values for calculations
          const calories = parseRange(totalNutrition.calories);
          const protein = parseRange(totalNutrition.protein);
          const carbs = parseRange(totalNutrition.carbs);
          const fats = parseRange(totalNutrition.fats);
          const fiber = parseRange(totalNutrition.fiber);
          const sugar = parseRange(totalNutrition.sugar);
          const sodium = parseRange(totalNutrition.sodium);
          
          // Calculate health score based on nutrition
          let healthScore = 70; // Base score
          if (calories > 500) healthScore -= 10;
          if (calories > 700) healthScore -= 10;
          if (protein > 15) healthScore += 10;
          if (fiber > 5) healthScore += 10;
          if (sugar > 20) healthScore -= 10;
          if (sodium > 500) healthScore -= 10;
          healthScore = Math.max(0, Math.min(100, healthScore));
          
          // Transform alternatives from image analysis
          const alternatives = Array.isArray(imageAnalysis.data.alternatives) 
            ? imageAnalysis.data.alternatives.map(alt => ({
                name: alt.name || '',
                description: alt.description || '',
                nutrition: {
                  calories: parseRange(alt.calories),
                  protein: parseRange(alt.protein),
                  carbs: parseRange(alt.carbs),
                  fats: parseRange(alt.fats),
                  fiber: parseRange(alt.fiber || 0)
                },
                benefits: alt.benefits || ''
              }))
            : [];
          
          // Create analysis with both numeric and range values
          analysis = {
            success: true,
            data: {
              foodItem: {
                name: firstItem.name || 'Food from image',
                quantity: firstItem.quantity || 'See image',
                nutrition: {
                  calories: calories,
                  protein: protein,
                  carbs: carbs,
                  fats: fats,
                  fiber: fiber,
                  sugar: sugar,
                  sodium: sodium
                },
                // Store range strings for display
                nutritionRanges: {
                  calories: formatRange(totalNutrition.calories),
                  protein: formatRange(totalNutrition.protein),
                  carbs: formatRange(totalNutrition.carbs),
                  fats: formatRange(totalNutrition.fats),
                  fiber: formatRange(totalNutrition.fiber),
                  sugar: formatRange(totalNutrition.sugar),
                  sodium: formatRange(totalNutrition.sodium)
                }
              },
              healthScore: healthScore,
              isHealthy: healthScore >= 70,
              analysis: imageAnalysis.data.analysis || 'Food analyzed from image',
              warnings: healthScore < 70 ? ['High calorie content', 'Consider healthier alternatives'] : [],
              benefits: healthScore >= 70 ? ['Good nutritional balance'] : [],
              alternatives: alternatives
            }
          };
          
          console.log('Analysis transformed successfully');
          console.log('Health score:', healthScore);
          console.log('Nutrition ranges:', analysis.data.foodItem.nutritionRanges);
          console.log('Alternatives count:', alternatives.length);
        }
      } catch (imageError) {
        console.error('Image analysis failed:', imageError.message);
        console.error('Error details:', imageError.response?.data || imageError);
        console.error('Falling back to text analysis');
        // Fallback to text analysis if image fails
        analysis = await nutritionAI.quickFoodCheck(additionalContext || foodDescription || 'Food from image');
      }
    } else {
      console.log('Using text analysis');
      analysis = await nutritionAI.quickFoodCheck(foodDescription);
    }

    if (!analysis.success || !analysis.data) {
      throw new Error('Failed to analyze food');
    }

    const QuickFoodCheck = require('../models/QuickFoodCheck');
    
    // Ensure alternatives is always an array
    const alternativesArray = Array.isArray(analysis.data.alternatives) 
      ? analysis.data.alternatives 
      : [];
    
    // Save to database for permanent storage with ALL details
    const foodCheck = new QuickFoodCheck({
      userId: req.user._id,
      foodName: analysis.data.foodItem?.name || foodDescription,
      quantity: analysis.data.foodItem?.quantity || 'Not specified',
      calories: analysis.data.foodItem?.nutrition?.calories || 0,
      protein: analysis.data.foodItem?.nutrition?.protein || 0,
      carbs: analysis.data.foodItem?.nutrition?.carbs || 0,
      fats: analysis.data.foodItem?.nutrition?.fats || 0,
      nutrition: analysis.data.foodItem?.nutrition || {},
      healthScore: analysis.data.healthScore || 50,
      isHealthy: analysis.data.isHealthy || false,
      analysis: analysis.data.analysis || '',
      warnings: Array.isArray(analysis.data.warnings) ? analysis.data.warnings : [],
      benefits: Array.isArray(analysis.data.benefits) ? analysis.data.benefits : [],
      alternatives: alternativesArray,
      imageUrl: imageBase64 ? `data:image/jpeg;base64,${imageBase64.substring(0, 100)}...` : null,
      timestamp: new Date()
    });

    await foodCheck.save();

    console.log('Food check saved successfully');

    res.json({
      success: true,
      data: analysis.data,
      savedId: foodCheck._id,
      message: 'Food analyzed and saved successfully'
    });
  } catch (error) {
    console.error('Quick food check error:', error);
    console.error('Error stack:', error.stack);
    res.status(500).json({
      success: false,
      message: 'Failed to analyze food',
      error: error.message,
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get healthy alternatives for a food
exports.getHealthyAlternatives = async (req, res) => {
  try {
    const { foodName } = req.body;

    if (!foodName) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a food name'
      });
    }

    // Get user's preferences
    const healthGoal = await HealthGoal.findOne({ userId: req.user._id });
    const User = require('../models/User');
    const user = await User.findById(req.user._id);

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todaySummary = await NutritionSummary.findOne({
      userId: req.user._id,
      date: today
    });

    const userPreferences = {
      dietaryPreference: healthGoal?.dietaryPreference || user.profile?.dietaryPreference,
      allergies: healthGoal?.allergies || user.profile?.allergies || [],
      goal: healthGoal?.goalType,
      remainingCalories: healthGoal && todaySummary 
        ? healthGoal.dailyCalorieTarget - todaySummary.totalCalories 
        : null
    };

    const result = await nutritionAI.getHealthyAlternatives(foodName, userPreferences);

    res.json({
      success: true,
      ...result.data,
      message: 'Alternatives generated successfully'
    });
  } catch (error) {
    console.error('Get alternatives error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get alternatives',
      error: error.message
    });
  }
};

module.exports = exports;


// Get all saved quick food checks for user
exports.getQuickFoodChecks = async (req, res) => {
  try {
    const { limit = 50, skip = 0, date } = req.query;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const query = { userId: req.user._id };

    // Filter by date if provided
    if (date) {
      const targetDate = new Date(date);
      targetDate.setHours(0, 0, 0, 0);
      const nextDate = new Date(targetDate);
      nextDate.setDate(nextDate.getDate() + 1);

      query.timestamp = {
        $gte: targetDate,
        $lt: nextDate
      };
    }

    const checks = await QuickFoodCheck.find(query)
      .sort({ timestamp: -1 })
      .limit(parseInt(limit))
      .skip(parseInt(skip));

    const total = await QuickFoodCheck.countDocuments(query);

    res.json({
      success: true,
      checks,
      total,
      limit: parseInt(limit),
      skip: parseInt(skip)
    });
  } catch (error) {
    console.error('Get quick food checks error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food checks',
      error: error.message
    });
  }
};

// Get single quick food check
exports.getQuickFoodCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const check = await QuickFoodCheck.findOne({
      _id: id,
      userId: req.user._id
    });

    if (!check) {
      return res.status(404).json({
        success: false,
        message: 'Food check not found'
      });
    }

    res.json({
      success: true,
      check
    });
  } catch (error) {
    console.error('Get quick food check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food check',
      error: error.message
    });
  }
};

// Delete quick food check
exports.deleteQuickFoodCheck = async (req, res) => {
  try {
    const { id } = req.params;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const check = await QuickFoodCheck.findOneAndDelete({
      _id: id,
      userId: req.user._id
    });

    if (!check) {
      return res.status(404).json({
        success: false,
        message: 'Food check not found'
      });
    }

    res.json({
      success: true,
      message: 'Food check deleted successfully'
    });
  } catch (error) {
    console.error('Delete quick food check error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to delete food check',
      error: error.message
    });
  }
};

// Get food check history for a specific date
exports.getFoodCheckHistory = async (req, res) => {
  try {
    const { date } = req.query;
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    if (!date) {
      return res.status(400).json({
        success: false,
        message: 'Date parameter is required'
      });
    }

    const targetDate = new Date(date);
    targetDate.setHours(0, 0, 0, 0);
    const nextDate = new Date(targetDate);
    nextDate.setDate(nextDate.getDate() + 1);

    const checks = await QuickFoodCheck.find({
      userId: req.user._id,
      timestamp: {
        $gte: targetDate,
        $lt: nextDate
      }
    }).sort({ timestamp: -1 });

    // Calculate daily stats
    const stats = {
      totalChecks: checks.length,
      healthyCount: checks.filter(c => c.isHealthy).length,
      unhealthyCount: checks.filter(c => !c.isHealthy).length,
      avgHealthScore: checks.length > 0 
        ? Math.round(checks.reduce((sum, c) => sum + (c.healthScore || 0), 0) / checks.length)
        : 0,
      checks
    };

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Get food check history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get food check history',
      error: error.message
    });
  }
};

// Get weekly food check summary
exports.getWeeklyFoodCheckSummary = async (req, res) => {
  try {
    const QuickFoodCheck = require('../models/QuickFoodCheck');

    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    
    const startDate = new Date(endDate);
    startDate.setDate(startDate.getDate() - 6);
    startDate.setHours(0, 0, 0, 0);

    const checks = await QuickFoodCheck.find({
      userId: req.user._id,
      timestamp: { $gte: startDate, $lte: endDate }
    }).sort({ timestamp: -1 });

    // Group by date
    const byDate = {};
    checks.forEach(check => {
      const dateKey = check.timestamp.toISOString().split('T')[0];
      if (!byDate[dateKey]) {
        byDate[dateKey] = [];
      }
      byDate[dateKey].push(check);
    });

    // Calculate weekly stats
    const weeklyStats = {
      totalChecks: checks.length,
      healthyCount: checks.filter(c => c.isHealthy).length,
      unhealthyCount: checks.filter(c => !c.isHealthy).length,
      avgHealthScore: checks.length > 0
        ? Math.round(checks.reduce((sum, c) => sum + (c.healthScore || 0), 0) / checks.length)
        : 0,
      daysActive: Object.keys(byDate).length,
      byDate,
      topUnhealthyFoods: checks
        .filter(c => !c.isHealthy)
        .slice(0, 5)
        .map(c => ({ name: c.foodName, healthScore: c.healthScore })),
      topHealthyFoods: checks
        .filter(c => c.isHealthy)
        .slice(0, 5)
        .map(c => ({ name: c.foodName, healthScore: c.healthScore }))
    };

    res.json({
      success: true,
      weeklyStats
    });
  } catch (error) {
    console.error('Get weekly food check summary error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to get weekly summary',
      error: error.message
    });
  }
};

// Get food image from SerpAPI
exports.getFoodImage = async (req, res) => {
  try {
    const { foodName } = req.query;

    if (!foodName) {
      return res.status(400).json({
        success: false,
        message: 'Food name is required'
      });
    }

    const axios = require('axios');
    const serpApiKey = process.env.SERP_API_KEY;

    if (!serpApiKey) {
      console.warn('SERP_API_KEY not configured');
      return res.json({
        success: false,
        message: 'Image search not configured'
      });
    }

    // Search for food image using SerpAPI Google Images
    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google_images',
        q: `${foodName} food dish`,
        api_key: serpApiKey,
        num: 1,
        safe: 'active'
      },
      timeout: 5000
    });

    if (response.data && response.data.images_results && response.data.images_results.length > 0) {
      const imageUrl = response.data.images_results[0].original;
      
      res.json({
        success: true,
        imageUrl,
        source: 'SerpAPI'
      });
    } else {
      res.json({
        success: false,
        message: 'No image found'
      });
    }
  } catch (error) {
    console.error('Get food image error:', error);
    res.json({
      success: false,
      message: 'Failed to fetch food image',
      error: error.message
    });
  }
};
