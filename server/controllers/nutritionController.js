const FoodLog = require('../models/FoodLog');
const HealthGoal = require('../models/HealthGoal');
const NutritionSummary = require('../models/NutritionSummary');
const nutritionAI = require('../services/nutritionAI');
const { uploadImage } = require('../services/cloudinary');

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

    let imageUrl = null;
    if (imageBase64) {
      // Analyze from image
      analysis = await nutritionAI.analyzeFromImage(imageBase64, additionalContext);

      // Upload to Cloudinary for consistent storage
      try {
        imageUrl = await uploadImage(`data:image/jpeg;base64,${imageBase64}`, 'logged_meals');
      } catch (e) {
        console.error('Cloudinary upload in analyzeFood failed:', e);
      }
    } else {
      // Analyze from text
      analysis = await nutritionAI.analyzeFromText(foodDescription);
    }

    res.json({
      success: true,
      analysis: {
        ...analysis.data,
        imageUrl
      },
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
    const {
      mealType,
      foodItems,
      imageUrl,
      notes,
      timestamp,
      healthScore,
      healthScore10,
      micronutrients,
      enhancementTips,
      healthBenefitsSummary
    } = req.body;

    if (!mealType || !foodItems || foodItems.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Meal type and food items are required'
      });
    }

    // Ensure arrays are sanitized properly
    const sanitizeMicronutrients = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => {
        if (typeof item === 'string') return { name: item, value: 'Unknown', percentage: 0 };
        return {
          name: item.name || 'Unknown',
          value: item.value || 'Unknown',
          percentage: Number(item.percentage) || 0
        };
      });
    };

    const sanitizeTips = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => {
        if (typeof item === 'string') return { name: item, benefit: item };
        return {
          name: item.name || 'Tip',
          benefit: item.benefit || item.description || ''
        };
      });
    };

    // Calculate total nutrition explicitly before saving to ensure summary is correct
    const totalNutrition = {
      calories: 0,
      protein: 0,
      carbs: 0,
      fats: 0,
      fiber: 0,
      sugar: 0,
      sodium: 0
    };

    foodItems.forEach(item => {
      if (item.nutrition) {
        totalNutrition.calories += Number(item.nutrition.calories) || 0;
        totalNutrition.protein += Number(item.nutrition.protein) || 0;
        totalNutrition.carbs += Number(item.nutrition.carbs) || 0;
        totalNutrition.fats += Number(item.nutrition.fats) || 0;
        totalNutrition.fiber += Number(item.nutrition.fiber) || 0;
        totalNutrition.sugar += Number(item.nutrition.sugar) || 0;
        totalNutrition.sodium += Number(item.nutrition.sodium) || 0;
      }
    });

    const foodLog = new FoodLog({
      userId: req.user._id,
      mealType,
      foodItems,
      totalNutrition,
      imageUrl,
      notes,
      healthScore,
      healthScore10,
      micronutrients: sanitizeMicronutrients(micronutrients),
      enhancementTips: sanitizeTips(enhancementTips),
      healthBenefitsSummary,
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
    const { startDate, endDate, mealType, date } = req.query;

    const query = { userId: req.user._id };

    if (date) {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0);
      const nextDay = new Date(d);
      nextDay.setDate(d.getDate() + 1);
      query.timestamp = { $gte: d, $lt: nextDay };
    } else if (startDate || endDate) {
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
    // Use UTC date part for consistency
    const queryDate = date ? new Date(date) : new Date();
    const targetDate = new Date(queryDate.toISOString().split('T')[0]);
    targetDate.setUTCHours(0, 0, 0, 0);

    console.log(`Fetching summary for user ${req.user._id} on ${targetDate.toISOString()}`);

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

// Get 7 days activity data for chart (relative to selected date)
exports.getActivityWeek = async (req, res) => {
  try {
    const { date } = req.query;
    const endDate = date ? new Date(date) : new Date();
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
  try {
    // Normalize date to UTC midnight for consistency
    const d = new Date(date);
    const targetDate = new Date(d.toISOString().split('T')[0]);
    targetDate.setUTCHours(0, 0, 0, 0);

    const nextDay = new Date(targetDate);
    nextDay.setUTCDate(nextDay.getUTCDate() + 1);

    console.log(`Updating daily summary for ${userId} from ${targetDate.toISOString()} to ${nextDay.toISOString()}`);

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
      totalSodium: 0,
      averageHealthScore: 0
    };

    const mealsLogged = {
      breakfast: false,
      lunch: false,
      dinner: false,
      snacks: 0
    };

    let totalWeight = 0;
    let weightedHealthScoreSum = 0;

    foodLogs.forEach(log => {
      // Use totalNutrition if available, otherwise sum foodItems as fallback
      const logNutrition = log.totalNutrition || { calories: 0, protein: 0, carbs: 0, fats: 0 };

      // Fallback: If totalNutrition is all 0 but foodItems are not, sum them
      let calories = Number(logNutrition.calories) || 0;
      let protein = Number(logNutrition.protein) || 0;
      let carbs = Number(logNutrition.carbs) || 0;
      let fats = Number(logNutrition.fats) || 0;
      let fiber = Number(logNutrition.fiber) || 0;

      if (calories === 0 && log.foodItems && log.foodItems.length > 0) {
        log.foodItems.forEach(item => {
          if (item.nutrition) {
            calories += Number(item.nutrition.calories) || 0;
            protein += Number(item.nutrition.protein) || 0;
            carbs += Number(item.nutrition.carbs) || 0;
            fats += Number(item.nutrition.fats) || 0;
            fiber += Number(item.nutrition.fiber) || 0;
          }
        });
      }

      totals.totalCalories += calories;
      totals.totalProtein += protein;
      totals.totalCarbs += carbs;
      totals.totalFats += fats;
      totals.totalFiber += fiber;
      totals.totalSugar += Number(logNutrition.sugar) || 0;
      totals.totalSodium += Number(logNutrition.sodium) || 0;

      // Weight the health score by calories of the item
      const healthScore = log.healthScore10 !== undefined ? log.healthScore10 * 10 : (log.healthScore || 50);
      weightedHealthScoreSum += healthScore * (calories || 100);
      totalWeight += (calories || 100);

      if (log.mealType === 'snack') {
        mealsLogged.snacks++;
      } else if (['breakfast', 'lunch', 'dinner'].includes(log.mealType)) {
        mealsLogged[log.mealType] = true;
      }
    });

    if (totalWeight > 0) {
      totals.averageHealthScore = Math.round(weightedHealthScoreSum / totalWeight);
    } else if (foodLogs.length > 0) {
      const totalScore = foodLogs.reduce((sum, log) => sum + (log.healthScore10 !== undefined ? log.healthScore10 * 10 : (log.healthScore || 50)), 0);
      totals.averageHealthScore = Math.round(totalScore / foodLogs.length);
    }

    // Get user's latest health goal
    const healthGoal = await HealthGoal.findOne({ userId, isActive: true }).sort({ createdAt: -1 });

    let summary = await NutritionSummary.findOne({ userId, date: targetDate });

    if (!summary) {
      summary = new NutritionSummary({ userId, date: targetDate });
    }

    // Update summary with calculated totals
    summary.totalCalories = totals.totalCalories;
    summary.totalProtein = totals.totalProtein;
    summary.totalCarbs = totals.totalCarbs;
    summary.totalFats = totals.totalFats;
    summary.totalFiber = totals.totalFiber;
    summary.totalSugar = totals.totalSugar;
    summary.totalSodium = totals.totalSodium;
    summary.averageHealthScore = totals.averageHealthScore;
    summary.mealsLogged = mealsLogged;

    if (healthGoal) {
      summary.calorieGoal = healthGoal.dailyCalorieTarget;
      summary.proteinGoal = healthGoal.macroTargets.protein;
      summary.carbsGoal = healthGoal.macroTargets.carbs;
      summary.fatsGoal = healthGoal.macroTargets.fats;
    }

    // Force recalculation of status and percentages
    if (typeof summary.calculateStatus === 'function') {
      summary.calculateStatus();
    }

    await summary.save();
    console.log(`Daily summary updated successfully for ${userId} on ${targetDate.toISOString()}. Total Cals: ${summary.totalCalories}`);
    return summary;
  } catch (error) {
    console.error('Update daily summary error:', error);
    return null;
  }
}

// Helper function to create daily summary
async function createDailySummary(userId, date) {
  return await updateDailySummary(userId, date);
}

// Quick food check without logging - with complete details persistence
exports.quickFoodCheck = async (req, res) => {
  try {
    const fs = require('fs');
    let { foodDescription, imageBase64, additionalContext } = req.body;

    let cloudinaryUrl = null;

    // ─── STEP 1: Extract base64 from uploaded file ───
    if (req.file) {
      console.log('📷 Received file upload via multer:', req.file.filename || 'memory-buffer');
      console.log('📷 File size:', `${(req.file.size / 1024).toFixed(2)} KB, MIME: ${req.file.mimetype}`);

      try {
        if (req.file.buffer) {
          // Memory storage (Vercel)
          imageBase64 = req.file.buffer.toString('base64');
        } else if (req.file.path) {
          // Disk storage (local)
          imageBase64 = fs.readFileSync(req.file.path, { encoding: 'base64' });
          // Delete temp file after reading
          fs.unlink(req.file.path, (err) => {
            if (err) console.error('Error deleting temp file:', err);
          });
        }

        console.log('📷 Extracted base64 from file, length:', imageBase64?.length || 0);
      } catch (fileError) {
        console.error('❌ Error extracting base64 from file:', fileError);
        return res.status(500).json({
          success: false,
          message: 'Failed to process uploaded image',
          error: fileError.message
        });
      }
    }

    // ─── STEP 2: Upload to Cloudinary (non-blocking — won't stop AI analysis) ───
    if (imageBase64) {
      try {
        const mimeType = req.file?.mimetype || 'image/jpeg';
        const dataUri = `data:${mimeType};base64,${imageBase64}`;
        console.log('☁️ Uploading to Cloudinary...');
        cloudinaryUrl = await uploadImage(dataUri, 'food_scans');
        console.log('☁️ Cloudinary result:', cloudinaryUrl ? '✅ ' + cloudinaryUrl : '❌ Failed (null)');
      } catch (cloudinaryError) {
        console.error('☁️ Cloudinary upload failed (continuing without it):', cloudinaryError.message);
        // Don't return error — continue with AI analysis even if Cloudinary fails
      }
    }

    console.log('🔍 Quick check request:', {
      hasDescription: !!foodDescription,
      hasImage: !!imageBase64,
      hasCloudinaryUrl: !!cloudinaryUrl,
      imageSource: req.file ? 'multipart-upload' : (imageBase64 ? 'base64-json' : 'none'),
      imageSize: imageBase64 ? `${(imageBase64.length * 0.75 / 1024).toFixed(2)} KB` : 'N/A',
      context: additionalContext
    });

    if (!foodDescription && !imageBase64) {
      return res.status(400).json({
        success: false,
        message: 'Please provide a food description or image'
      });
    }

    let analysis;

    // ─── STEP 3: AI Analysis — image or text ───
    if (imageBase64) {
      try {
        console.log('🧠 Attempting AI image analysis via Anthropic...');

        // Use image analysis — send base64 directly to Anthropic Claude Vision
        const imageAnalysis = await nutritionAI.analyzeFromImage(imageBase64, additionalContext || foodDescription || 'Food from image');

        console.log('🧠 Image analysis successful:', imageAnalysis.data?.foodItem?.name || 'Unknown food');

        // Check if AI couldn't detect food
        if (imageAnalysis.data?.error === 'UNABLE_TO_DETECT_FOOD') {
          return res.status(400).json({
            success: false,
            message: imageAnalysis.data.message || 'Could not detect food in image',
            error: 'UNABLE_TO_DETECT_FOOD'
          });
        }

        analysis = imageAnalysis;

      } catch (imageError) {
        console.error('❌ Image analysis failed:', imageError.message);
        console.error('❌ Full error:', imageError.response?.data || imageError.message);
        console.log('⚠️ Falling back to text analysis...');
        // Fallback to text analysis if image fails
        analysis = await nutritionAI.quickFoodCheck(additionalContext || foodDescription || 'Food from image');
      }
    } else {
      console.log('📝 Using text analysis for:', foodDescription);
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

    // Ensure arrays are sanitized properly
    const sanitizeMicronutrients = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => {
        if (typeof item === 'string') return { name: item, value: 'Unknown', percentage: 0 };
        return {
          name: item.name || 'Unknown',
          value: item.value || 'Unknown',
          percentage: Number(item.percentage) || 0
        };
      });
    };

    const sanitizeTips = (data) => {
      if (!Array.isArray(data)) return [];
      return data.map(item => {
        if (typeof item === 'string') return { name: item, benefit: item };
        return {
          name: item.name || 'Tip',
          benefit: item.benefit || item.description || ''
        };
      });
    };

    // ─── STEP 4: Construct final image URL — prefer Cloudinary ───
    let finalImageUrl = cloudinaryUrl;
    if (!finalImageUrl && imageBase64) {
      // If Cloudinary failed, use a small truncated base64 as last resort
      // (avoid storing giant base64 in DB)
      console.log('⚠️ No Cloudinary URL, using base64 data URI as fallback');
      finalImageUrl = `data:image/jpeg;base64,${imageBase64}`;
    }

    // ─── STEP 5: Save to MongoDB ───
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
      healthScore10: analysis.data.healthScore10 || (analysis.data.healthScore ? analysis.data.healthScore / 10 : 5),
      isHealthy: analysis.data.isHealthy || false,
      analysis: analysis.data.analysis || '',
      micronutrients: sanitizeMicronutrients(analysis.data.micronutrients),
      enhancementTips: sanitizeTips(analysis.data.enhancementTips),
      warnings: Array.isArray(analysis.data.warnings) ? analysis.data.warnings.map(w => typeof w === 'string' ? w : JSON.stringify(w)) : [],
      benefits: Array.isArray(analysis.data.benefits) ? analysis.data.benefits.map(b => typeof b === 'string' ? b : JSON.stringify(b)) : [],
      healthBenefitsSummary: analysis.data.healthBenefitsSummary || '',
      alternatives: alternativesArray,
      imageUrl: finalImageUrl,
      timestamp: new Date()
    });

    await foodCheck.save();

    console.log('✅ Food check saved. Cloudinary URL:', cloudinaryUrl || 'N/A');
    console.log('✅ Detected food:', analysis.data.foodItem?.name, '| Calories:', analysis.data.foodItem?.nutrition?.calories);

    res.json({
      success: true,
      data: {
        ...analysis.data,
        imageUrl: finalImageUrl
      },
      savedId: foodCheck._id,
      message: 'Food analyzed and saved successfully'
    });
  } catch (error) {
    console.error('❌ Quick food check error:', error);
    console.error('❌ Error stack:', error.stack);
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
