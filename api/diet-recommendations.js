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
    // JWT token uses 'id' field, not 'userId'
    req.user = { _id: decoded.id || decoded.userId };
    console.log('🔐 Auth middleware - decoded:', decoded);
    console.log('🔐 Auth middleware - req.user:', req.user);
    next();
  } catch (error) {
    console.error('🔐 Auth error:', error.message);
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
    
    console.log('🔍 Generating diet plan for user:', userId);
    console.log('🔍 User ID type:', typeof userId, userId);

    // Get nutrition goal from HealthGoal collection
    const HealthGoal = require('../server/models/HealthGoal');
    
    // Try to find health goal - userId is already correct from auth middleware
    console.log('🔍 Searching for health goal...');
    const healthGoal = await HealthGoal.findOne({ userId });
    if (!healthGoal) {
      // Check if any goals exist in database
      const allGoals = await HealthGoal.find({}).limit(5);
      const totalGoals = await HealthGoal.countDocuments();
      console.log('📊 Total goals in DB:', totalGoals);
      console.log('📊 Sample goals:', allGoals.map(g => ({ 
        userId: String(g.userId), 
        goalType: g.goalType 
      })));
      console.log('📊 Searched userId:', String(userId));
      
      return res.status(404).json({ 
        success: false, 
        message: 'No nutrition goal found. Please set your goals first.',
        debug: {
          searchedUserId: String(userId),
          totalGoalsInDB: totalGoals,
          sampleUserIds: allGoals.map(g => String(g.userId))
        }
      });
    }

    console.log('✅ Found health goal:', healthGoal.goalType);

    // Get user profile (optional - use healthGoal data if user not found)
    let user = await User.findById(userId);
    
    // Use healthGoal data as primary source
    const currentWeight = healthGoal.currentWeight || user?.profile?.weight || 70;
    const targetWeight = healthGoal.targetWeight || currentWeight;
    const height = healthGoal.height || user?.profile?.height || 170;
    const age = healthGoal.age || user?.profile?.age || 25;
    const gender = healthGoal.gender || user?.profile?.gender || 'male';
    const activityLevel = healthGoal.activityLevel || user?.profile?.activityLevel || 'moderate';
    const dietaryPreference = healthGoal.dietaryPreference || user?.profile?.dietaryPreference || 'non-vegetarian';
    
    const heightInMeters = height / 100;
    const currentBMI = currentWeight / (heightInMeters * heightInMeters);

    // Use the calculated values from healthGoal if available
    const dailyCalorieTarget = healthGoal.dailyCalorieTarget || 2500;
    const macroTargets = healthGoal.macroTargets || {
      protein: 112,
      carbs: 300,
      fats: 70
    };

    console.log('📊 User stats:', { currentWeight, targetWeight, height, age, gender, dailyCalorieTarget });

    // Generate simple meal plan based on goal
    const goalType = healthGoal.goalType;
    let mealPlan = {};

    if (goalType === 'weight_gain') {
      mealPlan = {
        breakfast: [
          {
            name: 'Protein-Rich Oatmeal Bowl',
            description: '1 cup oats, 2 scoops protein powder, 1 banana, 2 tbsp peanut butter, 1 cup milk',
            calories: 650,
            protein: 45,
            benefits: 'High protein and complex carbs for muscle building'
          },
          {
            name: 'Egg & Avocado Toast',
            description: '3 whole eggs, 2 slices whole grain bread, 1/2 avocado, cheese',
            calories: 580,
            protein: 32,
            benefits: 'Healthy fats and protein for sustained energy'
          }
        ],
        lunch: [
          {
            name: 'Chicken & Rice Bowl',
            description: '200g grilled chicken, 2 cups brown rice, mixed vegetables, olive oil',
            calories: 750,
            protein: 55,
            benefits: 'Lean protein with complex carbs for muscle growth'
          },
          {
            name: 'Salmon with Sweet Potato',
            description: '200g salmon, 2 medium sweet potatoes, broccoli, butter',
            calories: 720,
            protein: 48,
            benefits: 'Omega-3 fats and quality protein'
          }
        ],
        dinner: [
          {
            name: 'Beef Stir-Fry',
            description: '200g lean beef, 1.5 cups rice, mixed vegetables, sesame oil',
            calories: 680,
            protein: 50,
            benefits: 'High protein and iron for muscle recovery'
          },
          {
            name: 'Turkey & Quinoa',
            description: '200g ground turkey, 1.5 cups quinoa, vegetables, olive oil',
            calories: 650,
            protein: 52,
            benefits: 'Complete protein with all essential amino acids'
          }
        ],
        snacks: [
          {
            name: 'Protein Shake',
            description: '2 scoops whey protein, 1 banana, 2 tbsp peanut butter, milk',
            calories: 450,
            protein: 50,
            benefits: 'Quick protein absorption post-workout'
          },
          {
            name: 'Greek Yogurt & Nuts',
            description: '2 cups Greek yogurt, 1/4 cup almonds, honey, berries',
            calories: 420,
            protein: 35,
            benefits: 'Protein and healthy fats for muscle building'
          }
        ]
      };
    } else if (goalType === 'weight_loss') {
      mealPlan = {
        breakfast: [
          {
            name: 'Egg White Omelette',
            description: '4 egg whites, vegetables, 1 slice whole grain toast',
            calories: 280,
            protein: 28,
            benefits: 'High protein, low calorie to preserve muscle'
          }
        ],
        lunch: [
          {
            name: 'Grilled Chicken Salad',
            description: '150g chicken breast, mixed greens, olive oil dressing',
            calories: 350,
            protein: 40,
            benefits: 'Lean protein with fiber for satiety'
          }
        ],
        dinner: [
          {
            name: 'Baked Fish & Vegetables',
            description: '150g white fish, steamed vegetables, lemon',
            calories: 320,
            protein: 38,
            benefits: 'Low calorie, high protein meal'
          }
        ],
        snacks: [
          {
            name: 'Protein Shake',
            description: '1 scoop protein, water, berries',
            calories: 150,
            protein: 25,
            benefits: 'Low calorie protein boost'
          }
        ]
      };
    } else {
      // maintain or general health
      mealPlan = {
        breakfast: [
          {
            name: 'Balanced Breakfast Bowl',
            description: '2 eggs, 1 cup oats, fruits, nuts',
            calories: 450,
            protein: 25,
            benefits: 'Balanced macros for sustained energy'
          }
        ],
        lunch: [
          {
            name: 'Chicken & Quinoa',
            description: '150g chicken, 1 cup quinoa, vegetables',
            calories: 520,
            protein: 42,
            benefits: 'Complete nutrition with all macros'
          }
        ],
        dinner: [
          {
            name: 'Salmon & Brown Rice',
            description: '150g salmon, 1 cup brown rice, vegetables',
            calories: 550,
            protein: 40,
            benefits: 'Omega-3 and balanced nutrition'
          }
        ],
        snacks: [
          {
            name: 'Greek Yogurt & Fruit',
            description: '1 cup Greek yogurt, mixed berries, honey',
            calories: 220,
            protein: 20,
            benefits: 'Protein and probiotics'
          }
        ]
      };
    }

    // Deactivate old diet plans
    await PersonalizedDietPlan.updateMany(
      { userId, isActive: true },
      { isActive: false }
    );

    // Save new diet plan
    const dietPlan = new PersonalizedDietPlan({
      userId,
      inputData: {
        age,
        gender,
        weight: currentWeight,
        height,
        currentBMI: currentBMI.toFixed(1),
        bmiGoal: goalType,
        targetWeight,
        dietaryPreference,
        activityLevel,
        hasReports: false
      },
      dailyCalorieTarget,
      macroTargets,
      mealPlan,
      lifestyleRecommendations: [
        'Drink at least 3-4 liters of water daily',
        'Get 7-8 hours of quality sleep',
        'Exercise 4-5 times per week',
        'Track your meals and progress weekly',
        'Stay consistent with your nutrition plan'
      ],
      generatedAt: new Date(),
      validUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
      isActive: true
    });

    await dietPlan.save();

    console.log('✅ Diet plan saved successfully');

    res.json({
      success: true,
      message: 'Personalized diet plan generated successfully',
      dietPlan
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
