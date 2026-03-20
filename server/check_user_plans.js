const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const connectDB = require('./config/db');

async function checkUserPlans(id) {
    await connectDB();
    try {
        const plans = await PersonalizedDietPlan.find({ userId: id }).sort({ generatedAt: -1 });
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

const id = "69412a3b2592607a98c5afea";
checkUserPlans(id);
