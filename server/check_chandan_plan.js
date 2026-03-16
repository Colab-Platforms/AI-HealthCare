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

async function checkPlan(userId) {
    await connectDB_custom();
    try {
        const plan = await PersonalizedDietPlan.findOne({ userId }).sort({ createdAt: -1 });
        if (plan) {
            console.log(`Plan for ${userId}:`);
            console.log(`  isActive: ${plan.isActive}`);
            console.log(`  validUntil: ${plan.validUntil}`);
            console.log(`  Now: ${new Date()}`);
            console.log(`  Is Valid: ${new Date(plan.validUntil) > new Date()}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkPlan("69b43300a8da6a2215f6b2df");
