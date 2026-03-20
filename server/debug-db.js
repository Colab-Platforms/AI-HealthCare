const mongoose = require('mongoose');
const FoodAdulteration = require('./models/FoodAdulteration');
require('dotenv').config();

async function checkDB() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const count = await FoodAdulteration.countDocuments();
    console.log('Total FoodAdulteration records:', count);
    if (count > 0) {
      const items = await FoodAdulteration.find().limit(2);
      console.log('Sample Full Items:', JSON.stringify(items, null, 2));
    }
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

checkDB();
