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

async function fixActivePlans() {
    await connectDB_custom();
    try {
        // Find all users
        const userIds = await PersonalizedDietPlan.distinct('userId');
        console.log(`Checking ${userIds.length} users for plan visibility issues...`);
        
        for (const userId of userIds) {
            // Check if user has an active, valid plan
            const activePlan = await PersonalizedDietPlan.findOne({
                userId,
                isActive: true,
                validUntil: { $gt: new Date() }
            });
            
            if (!activePlan) {
                // Find latest valid plan that is inactive
                const latestValidPlan = await PersonalizedDietPlan.findOne({
                    userId,
                    isActive: false,
                    validUntil: { $gt: new Date() }
                }).sort({ generatedAt: -1 });
                
                if (latestValidPlan) {
                    console.log(`Re-activating plan ${latestValidPlan._id} for user ${userId}`);
                    latestValidPlan.isActive = true;
                    await latestValidPlan.save();
                }
            }
        }
        console.log("Fix complete.");
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

fixActivePlans();
