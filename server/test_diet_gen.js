const dotenv = require('dotenv');
dotenv.config();
const mongoose = require('mongoose');
const connectDB = require('./config/db');
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const dietRecommendationAI = require('./services/dietRecommendationAI');

async function testDietGen() {
    const userData = {
        age: 30,
        gender: 'male',
        currentBMI: 24,
        bmiGoal: 'maintain',
        activityLevel: 'moderately_active',
        dietaryPreference: 'vegetarian',
        medicalConditions: [],
        allergies: [],
        nutritionGoals: {
            dailyCalories: 2000,
            protein: 120,
            carbs: 250,
            fats: 60
        },
        foodPreferences: {
            preferredFoods: ['Paneer'],
            foodsToAvoid: [],
            dietaryRestrictions: [],
            mealPreferences: {
                breakfast: ['Poha'],
                lunch: ['Thali'],
                dinner: ['Soup']
            }
        }
    };

    console.log("Testing Diet Gen with claude-sonnet-4-6...");
    try {
        await connectDB();
        const plan = await dietRecommendationAI.generatePersonalizedDietPlan(userData, "test regeneration");
        console.log("SUCCESS! Generated plan keys:", Object.keys(plan));
        
        // Try to save to DB
        const dietPlan = new PersonalizedDietPlan({
            ...plan,
            userId: new mongoose.Types.ObjectId('69b11fed19ae23f6edf70c90'), // Dummy ID
            generatedAt: new Date(),
            isActive: true,
            nutritionGoals: {
                dailyCalorieTarget: 2000,
                macroTargets: { protein: 120, carbs: 250, fats: 60 }
            }
        });
        
        await dietPlan.save();
        console.log("SUCCESS! Saved to DB.");
        process.exit(0);
    } catch (err) {
        console.error("FAILED:", err.message);
        if (err.errors) {
            console.error("VALIDATION ERRORS:", Object.keys(err.errors).map(k => `${k}: ${err.errors[k].message}`));
        }
        process.exit(1);
    }
}

testDietGen();
