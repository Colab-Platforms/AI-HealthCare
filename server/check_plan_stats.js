const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const connectDB = require('./config/db');

async function checkAllPlans() {
    await connectDB();
    try {
        const stats = await PersonalizedDietPlan.aggregate([
            { $group: { _id: "$userId", count: { $sum: 1 }, activeCount: { $sum: { $cond: ["$isActive", 1, 0] } } } }
        ]);
        console.log(`Found ${stats.length} users with plans.`);
        stats.forEach(s => {
            console.log(`User: ${s._id}, Total Plans: ${s.count}, Active Plans: ${s.activeCount}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkAllPlans();
