
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const QuickFoodCheck = require('./models/QuickFoodCheck');

async function run() {
  const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/healthcare-platform';
  await mongoose.connect(MONGODB_URI);
  console.log('Connected to DB');

  const counts = await QuickFoodCheck.aggregate([
    {
      $group: {
        _id: null,
        total: { $sum: 1 },
        hasAnalysis: { $sum: { $cond: [{ $gt: ["$analysis", ""] }, 1, 0] } },
        hasBenefits: { $sum: { $cond: [{ $gt: [{ $size: "$benefits" }, 0] }, 1, 0] } },
        hasMacros: { $sum: { $cond: [{ $gt: ["$calories", 0] }, 1, 0] } }
      }
    }
  ]);
  console.log('STATS:', JSON.stringify(counts, null, 2));

  const sample = await QuickFoodCheck.find({ 
    $or: [{ benefits: { $gt: { $size: 0 } } }, { calories: { $gt: 0 } }]
  }).limit(3);
  console.log('SAMPLES WITH DATA:', JSON.stringify(sample, null, 2));

  await mongoose.disconnect();
}

run().catch(console.error);
