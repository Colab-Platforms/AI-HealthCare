const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const PersonalizedDietPlan = require('./models/PersonalizedDietPlan');

async function testControllerQuery(userId) {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const dietPlan = await PersonalizedDietPlan.findOne({
      userId,
      isActive: true,
      validUntil: { $gt: new Date() }
    }).sort({ generatedAt: -1 });
    
    console.log(`Query for ${userId} result:`, dietPlan ? `Found plan ${dietPlan._id}` : "NULL");
    if (dietPlan) {
        console.log(`  isActive: ${dietPlan.isActive}`);
        console.log(`  validUntil: ${dietPlan.validUntil}`);
        console.log(`  Now: ${new Date()}`);
    }
  } catch (err) {
    console.error(err);
  } finally {
    mongoose.connection.close();
  }
}

testControllerQuery("69b43300a8da6a2215f6b2df");
