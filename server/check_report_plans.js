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

async function checkReportBasedPlans() {
    await connectDB_custom();
    try {
        const plans = await PersonalizedDietPlan.find({ "inputData.hasReports": true });
        console.log(`Found ${plans.length} plans based on health reports.`);
        
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: UserID: ${p.userId}, Active: ${p.isActive}, Generated: ${p.generatedAt}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkReportBasedPlans();
