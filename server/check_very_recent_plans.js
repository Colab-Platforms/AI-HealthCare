const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');

const connectDB_custom = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✓ MongoDB Connected');
  } catch (error) {
    console.error('Error connecting to MongoDB:', error.message);
  }
};

async function checkVeryRecentPlans() {
    await connectDB_custom();
    try {
        const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000);
        const plans = await PersonalizedDietPlan.find({ createdAt: { $gt: tenMinutesAgo } }).sort({ createdAt: -1 });
        console.log(`Found ${plans.length} plans generated in the last 10 minutes.`);
        
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: UserID: ${p.userId}, Active: ${p.isActive}, Generated: ${p.generatedAt}`);
            console.log(`  MealPlan Schema: ${JSON.stringify(Object.keys(p.mealPlan || {}))}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkVeryRecentPlans();
