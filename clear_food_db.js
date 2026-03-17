const mongoose = require('mongoose');

// Try to get URI from env or common defaults
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/healthcare-ai';

async function clearDb() {
  try {
    await mongoose.connect(MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Define schema on the fly to avoid import issues
    const QuickFoodCheck = mongoose.model('QuickFoodCheck', new mongoose.Schema({}), 'quickfoodchecks');
    
    const count = await QuickFoodCheck.countDocuments({});
    console.log(`Found ${count} food items in Global Database`);
    
    const result = await QuickFoodCheck.deleteMany({});
    console.log(`Successfully deleted ${result.deletedCount} food items`);
    
    process.exit(0);
  } catch (err) {
    console.error('Error clearing database:', err);
    process.exit(1);
  }
}

clearDb();
