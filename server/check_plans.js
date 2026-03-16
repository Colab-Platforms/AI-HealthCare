const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');
const User = require('./models/User');
const connectDB = require('./config/db');

async function checkPlans() {
    await connectDB();
    try {
        const user = await User.findOne({});
        if (!user) {
            console.log("No users found");
            process.exit(0);
        }
        console.log(`Checking plans for User: ${user.name} (${user._id})`);
        
        const plans = await PersonalizedDietPlan.find({ userId: user._id }).sort({ createdAt: -1 });
        console.log(`Found ${plans.length} plans total.`);
        
        plans.forEach((p, i) => {
            console.log(`Plan ${i+1}:`);
            console.log(`  _id: ${p._id}`);
            console.log(`  isActive: ${p.isActive}`);
            console.log(`  generatedAt: ${p.generatedAt}`);
            console.log(`  validUntil: ${p.validUntil}`);
            console.log(`  Expired: ${new Date(p.validUntil) < new Date()}`);
            console.log(`  Has mealPlan: ${!!p.mealPlan}`);
            if (p.mealPlan) {
                console.log(`  Breakfast options: ${p.mealPlan.breakfast?.length}`);
            }
        });
        
        const activePlan = await PersonalizedDietPlan.findOne({
            userId: user._id,
            isActive: true,
            validUntil: { $gt: new Date() }
        });
        console.log("\nActive Plan Found in controller-style query:", activePlan ? activePlan._id : "NONE");
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkPlans();
