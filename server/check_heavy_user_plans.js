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

async function checkUserPlans(id) {
    await connectDB_custom();
    try {
        const plans = await PersonalizedDietPlan.find({ userId: id }).sort({ createdAt: -1 });
        console.log(`Found ${plans.length} plans for user ${id}`);
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: Active: ${p.isActive}, ValidUntil: ${p.validUntil}, GeneratedAt: ${p.generatedAt}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

const id = "6981c5884a5c6e7265dd54f1";
checkUserPlans(id);
