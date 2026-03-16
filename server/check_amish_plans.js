const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');

// Connection logic from server.js
const connectDB_custom = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
  }
};

async function checkUserPlans(id) {
    await connectDB_custom();
    try {
        const plans = await PersonalizedDietPlan.find({ userId: id }).sort({ generatedAt: -1 });
        console.log(`Found ${plans.length} plans for user ${id}`);
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: Active: ${p.isActive}, ValidUntil: ${p.validUntil}, GeneratedAt: ${p.generatedAt}`);
            console.log(`  MealPlan exists: ${!!p.mealPlan}`);
            if (p.mealPlan) {
                console.log(`  Breakfast: ${p.mealPlan.breakfast?.length}, Lunch: ${p.mealPlan.lunch?.length}, Dinner: ${p.mealPlan.dinner?.length}`);
            }
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

const id = "69b2a23f1a19ba6cf27ae939";
checkUserPlans(id);
