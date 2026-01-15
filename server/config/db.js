const mongoose = require('mongoose');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI);
    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.error(`\n❌ MongoDB Connection Error: ${error.message}`);
    console.error(`\n📋 To fix this, you need MongoDB running. Options:`);
    console.error(`   1. Install MongoDB locally: https://www.mongodb.com/try/download/community`);
    console.error(`   2. Use MongoDB Atlas (free): https://www.mongodb.com/cloud/atlas`);
    console.error(`      - Create a free cluster`);
    console.error(`      - Get connection string and update MONGODB_URI in .env`);
    console.error(`\n   Example Atlas URI: mongodb+srv://user:pass@cluster.mongodb.net/healthcare-ai\n`);
    process.exit(1);
  }
};

module.exports = connectDB;
