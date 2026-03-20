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

async function checkSpecificPlan() {
    await connectDB_custom();
    try {
        const plan = await PersonalizedDietPlan.findOne({ userId: "69899271afda56fae255940c" }).sort({ createdAt: -1 });
        if (plan) {
            console.log(`Plan ID: ${plan._id}`);
            console.log(`Active: ${plan.isActive}`);
            console.log(`validUntil: ${plan.validUntil}`);
            console.log(`Now: ${new Date()}`);
        }
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkSpecificPlan();
