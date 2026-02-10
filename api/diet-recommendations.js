// Vercel serverless function for diet recommendations
const path = require('path');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config({ path: path.join(__dirname, '../server/.env') });
process.env.VERCEL = '1';
process.env.NODE_ENV = 'production';

const express = require('express');
const cors = require('cors');
const connectDB = require('../server/config/db');

// Initialize Express app
const app = express();

// Middleware
app.use(cors({ origin: '*', credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Initialize database
let dbInitialized = false;
const initDB = async () => {
  if (dbInitialized) return;
  try {
    await connectDB();
    dbInitialized = true;
    console.log('✅ DB connected for diet recommendations');
  } catch (error) {
    console.error('❌ DB error:', error.message);
  }
};

// DB middleware
app.use((req, res, next) => {
  if (!dbInitialized) {
    initDB().then(() => next()).catch(() => next());
  } else {
    next();
  }
});

// Auth middleware
const jwt = require('jsonwebtoken');
const auth = (req, res, next) => {
  try {
    const token = req.header('Authorization')?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ message: 'No authentication token' });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = { _id: decoded.userId };
    next();
  } catch (error) {
    res.status(401).json({ message: 'Invalid token' });
  }
};

// Import models
const PersonalizedDietPlan = require('../server/models/PersonalizedDietPlan');
const User = require('../server/models/User');
const HealthReport = require('../server/models/HealthReport');
const dietRecommendationAI = require('../server/services/dietRecommendationAI');
const { calculateNutritionGoals } = require('../server/services/nutritionGoalCalculator');

// Routes - GET active diet plan
app.get('/api/diet-recommendations/diet-plan/active', auth, async (req, res) => {
  try {
    const dietPlan = await PersonalizedDietPlan.findOne({
      userId: req.user._id,
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
    console.error('Error fetching diet plan:', error);
    res.status(500).json({ 
      success: false,
      message: 'Error fetching diet plan',
      error: error.message 
    });
  }
});

app.post('/api/diet-recommendations/diet-plan/generate', auth, async (req, res) => {
  try {
    const userId = req.user._id;

    // Get user profile
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ success: false, message: 'User not found' });
    }

    // Get latest health reports
    const healthReports = await HealthReport.find({ userId })
      .sort({ uploadDate: -1 })
      .limit(5);

    // Check if user has any reports
    const hasReports = healthReports.length > 0;

    // Extract lab report insights (only if reports exist)
    const labReportInsights = [];
    const deficiencies = [];
    const reportConditions = [];

    if (hasReports) {
      healthReports.forEach(report => {
        if (report.aiAnalysis?.deficiencies) {
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
            labReportInsights.push({
              parameter: key,
              value: metric.value || '',
              unit: metric.unit || '',
              status: metric.status || 'noted',
              reportId: report._id
            });
            
            // Track abnormal conditions
            if (metric.status !== 'normal') {
              reportConditions.push({
                parameter: key,
                status: metric.status,
                value: metric.value
              });
            }
          });
        }

        // Extract key findings as conditions
        if (report.aiAnalysis?.keyFindings) {
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

    // Calculate user's nutrition goals based on BMI goal
    let nutritionGoals = null;
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
      // Use default goals if calculation fails
      nutritionGoals = {
        calorieGoal: 2000,
        proteinGoal: 150,
        carbsGoal: 200,
        fatGoal: 65
      };
    }

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
      medicalConditions: user.profile?.medicalConditions || [],
      allergies: user.profile?.allergies || [],
      hasReports: hasReports,
      labReports: labReportInsights,
      reportConditions: reportConditions,
      deficiencies: deficiencies,
      healthParameters: {
        bmi: currentBMI,
        bloodPressure: user.profile?.bloodPressure
      },
      nutritionGoals: {
        dailyCalories: nutritionGoals.calorieGoal,
        protein: nutritionGoals.proteinGoal,
        carbs: nutritionGoals.carbsGoal,
        fat: nutritionGoals.fatGoal
      }
    };

    // Generate AI-powered diet plan
    const aiDietPlan = await dietRecommendationAI.generatePersonalizedDietPlan(userData);

    // Deactivate old diet plans
    await PersonalizedDietPlan.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Save new diet plan with nutrition goals
    const dietPlan = new PersonalizedDietPlan({
      userId,
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
          fat: nutritionGoals.fatGoal
        }
      },
      ...aiDietPlan,
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true
    });

    await dietPlan.save();

    res.json({
      success: true,
      message: hasReports 
        ? 'Personalized diet plan generated based on your goal and health reports'
        : 'Personalized diet plan generated based on your nutrition goal',
      dietPlan,
      basedOn: hasReports ? 'goal_and_reports' : 'goal_only'
    });

  } catch (error) {
    console.error('Generate diet plan error:', error);
    res.status(500).json({
      success: false,
      message: 'Failed to generate diet plan',
      error: error.message
    });
  }
});

// Supplement recommendations routes
app.get('/api/diet-recommendations/supplements/active', auth, async (req, res) => {
  try {
    const SupplementRecommendation = require('../server/models/SupplementRecommendation');
    
    const recommendations = await SupplementRecommendation.findOne({
      userId: req.user._id,
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
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    success: false,
    message: err.message 
  });
});

// Export the Express app as a serverless function
module.exports = app;
