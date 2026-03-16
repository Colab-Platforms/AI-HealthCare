const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const connectDB = require('./config/db');

async function checkAllPlans() {
    await connectDB();
    try {
        const plans = await PersonalizedDietPlan.find({}).sort({ createdAt: -1 });
        console.log(`Found ${plans.length} plans total in the whole database.`);
        
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}: UserID: ${p.userId}, Active: ${p.isActive}, Generated: ${p.generatedAt}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkAllPlans();
