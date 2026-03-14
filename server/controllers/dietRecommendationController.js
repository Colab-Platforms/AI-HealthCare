const PersonalizedDietPlan = require('../models/PersonalizedDietPlan');
const SupplementRecommendation = require('../models/SupplementRecommendation');
const HealthReport = require('../models/HealthReport');
const User = require('../models/User');
const dietRecommendationAI = require('../services/dietRecommendationAI');
const { calculateNutritionGoals, getDietRecommendations } = require('../services/nutritionGoalCalculator');

/**
 * Generate personalized diet plan based on comprehensive health data
 */
exports.generatePersonalizedDietPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get latest health reports - ensure we use the correct field 'user'
    const healthReports = await HealthReport.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Check if user has any reports
    const hasReports = healthReports.length > 0;

    // Extract lab report insights (only if reports exist)
    const labReportInsights = [];
    const deficiencies = [];
    const reportConditions = [];

    if (hasReports) {
      healthReports.forEach(report => {
        if (report.aiAnalysis?.deficiencies && Array.isArray(report.aiAnalysis.deficiencies)) {
          report.aiAnalysis.deficiencies.forEach(def => {
            deficiencies.push({
              nutrient: def.name || def,
              severity: def.severity || 'detected',
              reportId: report._id
            });
          });
        }

        if (report.aiAnalysis?.metrics) {
          Object.entries(report.aiAnalysis.metrics).forEach(([key, metric]) => {
            if (metric && typeof metric === 'object') {
              labReportInsights.push({
                parameter: key,
                value: metric.value || '',
                unit: metric.unit || '',
                status: metric.status || 'noted',
                reportId: report._id
              });

              if (metric.status !== 'normal') {
                reportConditions.push({
                  parameter: key,
                  status: metric.status,
                  value: metric.value
                });
              }
            }
          });
        }

        if (report.aiAnalysis?.keyFindings && Array.isArray(report.aiAnalysis.keyFindings)) {
          report.aiAnalysis.keyFindings.forEach(finding => {
            reportConditions.push({ finding });
          });
        }
      });
    }

    // Get BMI and nutrition goal
    const bmiGoal = user.nutritionGoal?.goal || 'maintain';
    const targetWeight = user.nutritionGoal?.targetWeight;
    const currentWeight = user.profile?.weight || 70;
    const height = user.profile?.height || 170;
    const heightInMeters = height / 100;
    const currentBMI = currentWeight / (heightInMeters * heightInMeters);

    // Calculate user's nutrition goals or use saved ones
    let nutritionGoals = null;
    if (user.nutritionGoal?.calorieGoal && user.nutritionGoal?.calorieGoal > 0) {
      nutritionGoals = {
        calorieGoal: user.nutritionGoal.calorieGoal,
        proteinGoal: user.nutritionGoal.proteinGoal || 150,
        carbsGoal: user.nutritionGoal.carbsGoal || 200,
        fatGoal: user.nutritionGoal.fatGoal || 65
      };
    } else {
      try {
        nutritionGoals = calculateNutritionGoals({
          age: user.profile?.age || 25,
          gender: user.profile?.gender || 'male',
          weight: currentWeight,
          height: height,
          activityLevel: user.profile?.activityLevel || 'moderately_active',
          goal: bmiGoal,
          targetWeight: targetWeight
        });
      } catch (error) {
        console.warn('Could not calculate nutrition goals:', error.message);
        nutritionGoals = {
          calorieGoal: 2000,
          proteinGoal: 150,
          carbsGoal: 200,
          fatGoal: 65
        };
      }
    }

    // --- Diabetes detection ---
    const diabetesProfile = user.profile?.diabetesProfile || {};
    const medicalHistoryConditions = user.profile?.medicalHistory?.conditions || [];
    const chronicConditions = user.profile?.chronicConditions || [];
    const fitnessProfile = user.profile?.fitnessProfile || {};

    const isDiabetic = !!(
      diabetesProfile.type ||
      medicalHistoryConditions.some(c => /diabet/i.test(c)) ||
      chronicConditions.some(c => /diabet/i.test(c))
    );

    const isPrediabetic = !!(
      diabetesProfile.type === 'Prediabetes' ||
      medicalHistoryConditions.some(c => /prediabet/i.test(c))
    );

    const diabetesInfo = isDiabetic || isPrediabetic ? {
      isDiabetic,
      isPrediabetic,
      diabetesType: diabetesProfile.type || 'Type 2',
      diabetesStatus: diabetesProfile.status || 'detected',
      hba1c: diabetesProfile.hba1c,
      fastingGlucose: diabetesProfile.fastingGlucose,
      postMealGlucose: diabetesProfile.postMealGlucose,
      onMedication: diabetesProfile.onMedication,
      medicationType: diabetesProfile.medicationType || [],
    } : null;

    // Prepare user data for AI
    const userData = {
      age: user.profile?.age || 25,
      gender: user.profile?.gender || 'male',
      weight: currentWeight,
      height: height,
      currentBMI: currentBMI.toFixed(1),
      bmiGoal: bmiGoal,
      targetWeight: targetWeight,
      dietaryPreference: user.profile?.dietaryPreference || 'non-vegetarian',
      activityLevel: user.profile?.activityLevel || 'moderately_active',
      fitnessGoals: user.profile?.fitnessGoals || [],
      primaryFitnessGoal: fitnessProfile.primaryGoal || '',
      medicalConditions: [
        ...(user.profile?.medicalConditions || []),
        ...medicalHistoryConditions,
        ...chronicConditions
      ].filter((v, i, a) => v && a.indexOf(v) === i), // dedupe
      allergies: user.profile?.allergies || [],
      currentMedications: user.profile?.medicalHistory?.currentMedications || [],
      hasReports: hasReports,
      labReports: labReportInsights,
      reportConditions: reportConditions,
      deficiencies: deficiencies,
      diabetesInfo,            // ← full diabetes context
      healthParameters: {
        bmi: currentBMI,
        bloodPressure: user.profile?.bloodPressure
      },
      nutritionGoals: {
        dailyCalories: nutritionGoals.calorieGoal,
        protein: nutritionGoals.proteinGoal,
        carbs: nutritionGoals.carbsGoal,
        fats: nutritionGoals.fatGoal
      },
      foodPreferences: user.foodPreferences || {} // Pass food preferences to AI
    };

    // Generate AI-powered diet plan
    const isRegenerate = req.body?.isRegenerate || false;
    const promptEx = isRegenerate
      ? 'IMPORTANT: This is a REGENERATION request. You MUST provide COMPLETELY NEW and DIFFERENT meal options. Every single meal option must be fresh and unique.'
      : '';

    console.log(`[DietGeneration] Starting for user ${userId}. isRegenerate: ${isRegenerate}`);
    console.log(`[DietGeneration] User Preferences:`, JSON.stringify(userData.foodPreferences, null, 2));

    let aiDietPlan;
    try {
      console.log(`[DietGeneration] Calling AI Service...`);
      aiDietPlan = await dietRecommendationAI.generatePersonalizedDietPlan(userData, promptEx);
      if (!aiDietPlan || typeof aiDietPlan !== 'object') {
        throw new Error('AI returned invalid non-object data');
      }
    } catch (aiError) {
      console.error('[DietGeneration] AI Service Error:', aiError.message);
      return res.status(500).json({ 
        success: false, 
        message: 'AI failed to generate plan', 
        error: aiError.message,
        stack: process.env.NODE_ENV === 'development' ? aiError.stack : undefined
      });
    }

    console.log('[DietGeneration] AI plan received successfully');

    try {
      // Deactivate old diet plans
      const deactResult = await PersonalizedDietPlan.updateMany(
        { userId: userId, isActive: true },
        { isActive: false }
      );
      console.log(`[DietGeneration] Deactivated ${deactResult.modifiedCount} old plans`);

      const dietPlanData = {
        ...aiDietPlan,
        userId: userId,
        inputData: {
          age: userData.age,
          gender: userData.gender,
          weight: userData.weight,
          height: userData.height,
          currentBMI: userData.currentBMI,
          bmiGoal: userData.bmiGoal,
          targetWeight: userData.targetWeight,
          dietaryPreference: userData.dietaryPreference,
          activityLevel: userData.activityLevel,
          fitnessGoals: userData.fitnessGoals,
          medicalConditions: userData.medicalConditions,
          allergies: userData.allergies,
          hasReports: hasReports
        },
        labReportInsights,
        nutritionGoals: {
          dailyCalorieTarget: nutritionGoals.calorieGoal,
          macroTargets: {
            protein: nutritionGoals.proteinGoal,
            carbs: nutritionGoals.carbsGoal,
            fats: nutritionGoals.fatGoal
          }
        },
        generatedAt: new Date(),
        validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        isActive: true
      };

      // Ensure root macroTargets and dailyCalorieTarget are populated if AI didn't return them correctly
      if (!dietPlanData.dailyCalorieTarget) dietPlanData.dailyCalorieTarget = nutritionGoals.calorieGoal;
      if (!dietPlanData.macroTargets) {
        dietPlanData.macroTargets = {
          protein: nutritionGoals.proteinGoal,
          carbs: nutritionGoals.carbsGoal,
          fats: nutritionGoals.fatGoal
        };
      }

      console.log('[DietGeneration] Formatting final document and saving...');
      const dietPlan = new PersonalizedDietPlan(dietPlanData);

      await dietPlan.save();
      console.log('[DietGeneration] New plan saved to DB successfully: ', dietPlan._id);

      res.json({
        success: true,
        message: hasReports ? 'Plan generated with health reports' : 'Plan generated with goals',
        dietPlan
      });
    } catch (dbError) {
      console.error('[DietGeneration] Database Error:', dbError.message);
      res.status(500).json({ 
        success: false, 
        message: 'Failed to save generated plan to database', 
        error: dbError.message 
      });
    }

  } catch (error) {
    console.error('❌ Generate diet plan error:', error);
    if (error.name === 'ValidationError') {
      console.error('Validation Errors:', Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`));
    }
    res.status(500).json({
      success: false,
      message: 'Failed to generate diet plan',
      error: error.message,
      details: error.errors ? Object.keys(error.errors).map(key => `${key}: ${error.errors[key].message}`) : null
    });
  }
};

/**
 * Get active personalized diet plan
 */
exports.getActiveDietPlan = async (req, res) => {
  try {
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      userId,
      isActive: true,
      validUntil: { $gt: new Date() }
    }).sort({ generatedAt: -1 });

    if (!dietPlan) {
      return res.json({
        success: true,
        message: 'No active diet plan found',
        dietPlan: null
      });
    }

    res.json({
      success: true,
      dietPlan
    });
  } catch (error) {
    console.error('Get diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan',
      error: error.message
    });
  }
};

/**
 * Get diet plan history
 */
exports.getDietPlanHistory = async (req, res) => {
  try {
    const userId = req.user._id;

    const history = await PersonalizedDietPlan.find({ userId })
      .sort({ generatedAt: -1 })
      .limit(10)
      .select('generatedAt isActive inputData nutritionGoals');

    res.json({
      success: true,
      history
    });
  } catch (error) {
    console.error('Get diet plan history error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan history',
      error: error.message
    });
  }
};

/**
 * Get specific diet plan by ID
 */
exports.getDietPlanById = async (req, res) => {
  try {
    const { planId } = req.params;
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      _id: planId,
      userId
    });

    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
    }

    res.json({
      success: true,
      dietPlan
    });
  } catch (error) {
    console.error('Get diet plan by ID error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch diet plan',
      error: error.message
    });
  }
};

/**
 * Generate supplement recommendations
 */
exports.generateSupplementRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get latest health reports - using correct field name 'user'
    const healthReports = await HealthReport.find({ user: userId })
      .sort({ createdAt: -1 })
      .limit(5);

    // Extract deficiencies
    const deficiencies = [];
    healthReports.forEach(report => {
      if (report.aiAnalysis?.deficiencies) {
        report.aiAnalysis.deficiencies.forEach(def => {
          deficiencies.push({
            nutrient: def.name || def,
            severity: def.severity || 'detected',
            labValue: def.value || '',
            reportId: report._id
          });
        });
      }
    });

    if (deficiencies.length === 0) {
      return res.json({
        success: true,
        message: 'No deficiencies detected',
        recommendations: null
      });
    }

    // Prepare user data for AI
    const userData = {
      deficiencies,
      age: user.profile?.age || user.age,
      gender: user.profile?.gender || user.gender,
      dietaryPreference: user.profile?.dietaryPreference || 'non-vegetarian',
      medicalConditions: user.profile?.medicalConditions || [],
      currentMedications: user.profile?.currentMedications || []
    };

    // Generate AI-powered supplement recommendations
    const aiRecommendations = await dietRecommendationAI.generateSupplementRecommendations(userData);

    // Deactivate old recommendations
    await SupplementRecommendation.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Save new recommendations
    const recommendations = new SupplementRecommendation({
      userId,
      deficiencies,
      ...aiRecommendations
    });

    await recommendations.save();

    res.json({
      success: true,
      message: 'Supplement recommendations generated successfully',
      recommendations
    });

  } catch (error) {
    console.error('Generate supplement recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate supplement recommendations',
      error: error.message
    });
  }
};

/**
 * Get active supplement recommendations
 */
exports.getActiveSupplementRecommendations = async (req, res) => {
  try {
    const userId = req.user._id;

    const recommendations = await SupplementRecommendation.findOne({
      userId,
      isActive: true
    }).sort({ generatedAt: -1 });

    if (!recommendations) {
      return res.json({
        success: true,
        message: 'No active supplement recommendations found',
        recommendations: null
      });
    }

    res.json({
      success: true,
      recommendations
    });

  } catch (error) {
    console.error('Get supplement recommendations error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to fetch supplement recommendations',
      error: error.message
    });
  }
};

/**
 * Rate diet plan
 */
exports.rateDietPlan = async (req, res) => {
  try {
    const { planId } = req.params;
    const { rating, feedback } = req.body;
    const userId = req.user._id;

    const dietPlan = await PersonalizedDietPlan.findOne({
      _id: planId,
      userId
    });

    if (!dietPlan) {
      return res.status(404).json({
        success: false,
        message: 'Diet plan not found'
      });
    }

    dietPlan.userRating = rating;
    dietPlan.userFeedback = feedback;
    await dietPlan.save();

    res.json({
      success: true,
      message: 'Thank you for your feedback!'
    });

  } catch (error) {
    console.error('Rate diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to submit rating',
      error: error.message
    });
  }
};

/**
 * Track supplement usage
 */
exports.trackSupplementUsage = async (req, res) => {
  try {
    const { recommendationId } = req.params;
    const { supplementName, dosage, notes } = req.body;
    const userId = req.user._id;

    const recommendation = await SupplementRecommendation.findOne({
      _id: recommendationId,
      userId
    });

    if (!recommendation) {
      return res.status(404).json({
        success: false,
        message: 'Recommendation not found'
      });
    }

    recommendation.userStartedTaking.push({
      supplementName,
      startDate: new Date(),
      dosage,
      notes
    });

    await recommendation.save();

    res.json({
      success: true,
      message: 'Supplement usage tracked successfully'
    });

  } catch (error) {
    console.error('Track supplement usage error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to track supplement usage',
      error: error.message
    });
  }
};
