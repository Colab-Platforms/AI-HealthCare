const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const connectDB = require('./config/db');

async function checkRecentPlans() {
    await connectDB();
    try {
        const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
        const plans = await PersonalizedDietPlan.find({ createdAt: { $gt: yesterday } }).sort({ createdAt: -1 });
        console.log(`Found ${plans.length} plans generated in the last 24 hours.`);
        
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: UserID: ${p.userId}, Active: ${p.isActive}, Generated: ${p.createdAt}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkRecentPlans();
