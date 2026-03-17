const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();

const QuickFoodCheckSchema = new mongoose.Schema({}, { strict: false, collection: 'quickfoodchecks' });
const QuickFoodCheck = mongoose.model('QuickFoodCheck', QuickFoodCheckSchema);

async function clean() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB');

    // Remove ALL cached food entries to start fresh with quantity-aware records
    const result = await QuickFoodCheck.deleteMany({});
    console.log(`🧹 Removed ALL ${result.deletedCount} cached food entries.`);
    console.log('📦 Cache is now empty. New entries will be saved with quantity-aware keys.');

    await mongoose.connection.close();
    console.log('👋 Done.');
  } catch (err) {
    console.error('❌ Error:', err);
    process.exit(1);
  }
}

clean();
