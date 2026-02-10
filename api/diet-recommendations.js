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

    // Generate Indian-style meal plan based on goal
    const goalType = healthGoal.goalType;
    let mealPlan = {};

    if (goalType === 'weight_gain') {
      mealPlan = {
        breakfast: [
          {
            name: 'Paneer Paratha with Curd',
            description: '3 paneer parathas with ghee, 1 cup curd, 1 glass milk',
            calories: 680,
            protein: 42,
            benefits: 'High protein from paneer and milk, healthy fats from ghee for muscle building'
          },
          {
            name: 'Moong Dal Cheela with Eggs',
            description: '3 moong dal cheelas, 3 boiled eggs, green chutney, 1 glass milk',
            calories: 620,
            protein: 48,
            benefits: 'Complete protein from dal and eggs, easy to digest'
          }
        ],
        lunch: [
          {
            name: 'Chicken Biryani with Raita',
            description: '2 cups chicken biryani, 200g chicken pieces, 1 cup raita, salad',
            calories: 780,
            protein: 58,
            benefits: 'High protein from chicken, complex carbs from rice for energy'
          },
          {
            name: 'Dal Makhani with Roti & Paneer',
            description: '2 cups dal makhani, 4 rotis, 150g paneer bhurji, ghee',
            calories: 750,
            protein: 52,
            benefits: 'Protein-rich dal and paneer combination for muscle growth'
          }
        ],
        dinner: [
          {
            name: 'Mutton Curry with Rice',
            description: '200g mutton curry, 2 cups rice, mixed vegetable sabzi',
            calories: 720,
            protein: 54,
            benefits: 'High protein and iron from mutton for muscle recovery'
          },
          {
            name: 'Chicken Tikka with Roti',
            description: '250g chicken tikka, 4 rotis, dal tadka, ghee',
            calories: 690,
            protein: 56,
            benefits: 'Lean protein from chicken, healthy carbs from roti'
          }
        ],
        snacks: [
          {
            name: 'Protein Lassi with Dry Fruits',
            description: '2 cups lassi with protein powder, 1 banana, almonds, dates',
            calories: 480,
            protein: 45,
            benefits: 'Quick protein absorption, probiotics from curd'
          },
          {
            name: 'Paneer Tikka with Curd',
            description: '200g paneer tikka, 1 cup thick curd, handful of nuts',
            calories: 450,
            protein: 38,
            benefits: 'High protein snack for muscle building'
          }
        ]
      };
    } else if (goalType === 'weight_loss') {
      mealPlan = {
        breakfast: [
          {
            name: 'Moong Dal Cheela',
            description: '2 moong dal cheelas, green chutney, 1 cup buttermilk',
            calories: 280,
            protein: 22,
            benefits: 'High protein, low calorie, keeps you full longer'
          },
          {
            name: 'Oats Upma with Vegetables',
            description: '1 cup oats upma with mixed vegetables, 2 boiled egg whites',
            calories: 300,
            protein: 24,
            benefits: 'Fiber-rich oats with protein for satiety'
          }
        ],
        lunch: [
          {
            name: 'Grilled Chicken with Salad',
            description: '150g grilled chicken, mixed vegetable salad, 2 rotis',
            calories: 380,
            protein: 42,
            benefits: 'Lean protein with fiber, low calorie'
          },
          {
            name: 'Fish Curry with Brown Rice',
            description: '150g fish curry, 1 cup brown rice, steamed vegetables',
            calories: 360,
            protein: 38,
            benefits: 'Omega-3 from fish, low calorie meal'
          }
        ],
        dinner: [
          {
            name: 'Tandoori Chicken with Soup',
            description: '150g tandoori chicken, clear vegetable soup, cucumber salad',
            calories: 320,
            protein: 40,
            benefits: 'High protein, very low calorie dinner'
          },
          {
            name: 'Palak Paneer with Roti',
            description: '1 cup palak paneer, 2 rotis, cucumber raita',
            calories: 340,
            protein: 28,
            benefits: 'Protein from paneer, iron from spinach'
          }
        ],
        snacks: [
          {
            name: 'Sprouts Chaat',
            description: '1 cup mixed sprouts chaat with lemon, onions, tomatoes',
            calories: 180,
            protein: 18,
            benefits: 'High protein, low calorie, nutrient-dense'
          },
          {
            name: 'Roasted Chana',
            description: '1 cup roasted chana, green tea',
            calories: 160,
            protein: 16,
            benefits: 'Protein-rich, crunchy, satisfying snack'
          }
        ]
      };
    } else {
      // maintain or general health
      mealPlan = {
        breakfast: [
          {
            name: 'Poha with Peanuts',
            description: '2 cups poha with peanuts, curry leaves, 1 boiled egg, tea',
            calories: 420,
            protein: 18,
            benefits: 'Balanced meal with carbs, protein, and healthy fats'
          },
          {
            name: 'Idli Sambar with Chutney',
            description: '4 idlis, 1 cup sambar, coconut chutney, 1 glass milk',
            calories: 450,
            protein: 20,
            benefits: 'Fermented food for gut health, balanced nutrition'
          }
        ],
        lunch: [
          {
            name: 'Dal Chawal with Sabzi',
            description: '1 cup dal, 1.5 cups rice, mixed vegetable sabzi, curd',
            calories: 520,
            protein: 24,
            benefits: 'Complete balanced Indian meal with all nutrients'
          },
          {
            name: 'Chicken Curry with Roti',
            description: '150g chicken curry, 3 rotis, vegetable salad',
            calories: 540,
            protein: 38,
            benefits: 'Protein from chicken, fiber from roti and vegetables'
          }
        ],
        dinner: [
          {
            name: 'Khichdi with Curd',
            description: '2 cups dal khichdi, 1 cup curd, papad, pickle',
            calories: 480,
            protein: 22,
            benefits: 'Easy to digest, complete protein, comfort food'
          },
          {
            name: 'Fish Fry with Rice',
            description: '150g fish fry, 1 cup rice, dal, vegetable curry',
            calories: 520,
            protein: 36,
            benefits: 'Omega-3 from fish, balanced macros'
          }
        ],
        snacks: [
          {
            name: 'Masala Chai with Biscuits',
            description: '1 cup masala chai, 4 whole wheat biscuits, handful of nuts',
            calories: 240,
            protein: 8,
            benefits: 'Energy boost with antioxidants from tea'
          },
          {
            name: 'Fruit Chaat',
            description: '1 cup mixed fruit chaat with chaat masala, roasted peanuts',
            calories: 220,
            protein: 6,
            benefits: 'Vitamins, minerals, and natural sugars'
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
        'Drink at least 3-4 liters of water daily (include coconut water, buttermilk)',
        'Get 7-8 hours of quality sleep every night',
        'Exercise or yoga 4-5 times per week (morning walks, gym, or home workout)',
        'Eat meals at regular times - breakfast by 9 AM, lunch by 1 PM, dinner by 8 PM',
        'Include seasonal Indian fruits and vegetables in your diet',
        'Avoid junk food, packaged snacks, and excessive sugar',
        'Track your weight and measurements weekly'
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
