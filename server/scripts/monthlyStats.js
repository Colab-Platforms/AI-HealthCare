// Usage: node scripts/monthlyStats.js 2026-07
const path = require('path');
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../models/User');
const FoodLog = require('../models/FoodLog');
const QuickFoodCheck = require('../models/QuickFoodCheck');
const MedicalDocument = require('../models/MedicalDocument');
const HealthReport = require('../models/HealthReport');

dotenv.config({ path: path.resolve(__dirname, '../.env') });

const monthArg = process.argv[2]; // e.g. "2026-07"
if (!monthArg || !/^\d{4}-\d{2}$/.test(monthArg)) {
  console.error('Usage: node scripts/monthlyStats.js YYYY-MM   (e.g. 2026-07)');
  process.exit(1);
}

const [year, month] = monthArg.split('-').map(Number);
const start = new Date(Date.UTC(year, month - 1, 1));
const end = new Date(Date.UTC(year, month, 1));

const imageCountAgg = async (Model, field = 'imageUrls') => {
  const result = await Model.aggregate([
    { $match: { createdAt: { $gte: start, $lt: end } } },
    { $project: { imgCount: { $add: [1, { $size: { $ifNull: [`$${field}`, []] } }] } } },
    { $group: { _id: null, total: { $sum: '$imgCount' } } },
  ]);
  return result[0]?.total || 0;
};

const run = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log(`Connected to DB — stats for ${monthArg}\n`);

    const newUsers = await User.countDocuments({ createdAt: { $gte: start, $lt: end } });

    const foodLogRecords = await FoodLog.countDocuments({ createdAt: { $gte: start, $lt: end } });
    const foodLogImages = await imageCountAgg(FoodLog);

    const quickCheckRecords = await QuickFoodCheck.countDocuments({ createdAt: { $gte: start, $lt: end } });
    const quickCheckImages = await imageCountAgg(QuickFoodCheck);

    const medicalDocs = await MedicalDocument.countDocuments({ createdAt: { $gte: start, $lt: end } });
    const healthReports = await HealthReport.countDocuments({ createdAt: { $gte: start, $lt: end } });

    const profilePics = await User.countDocuments({
      createdAt: { $gte: start, $lt: end },
      profilePicture: { $exists: true, $ne: null },
    });

    const totalUploads = foodLogImages + quickCheckImages + medicalDocs + healthReports + profilePics;

    console.log('New users signed up      :', newUsers);
    console.log('---');
    console.log('Food log records          :', foodLogRecords, '(images:', foodLogImages + ')');
    console.log('Quick food-check records  :', quickCheckRecords, '(images:', quickCheckImages + ')');
    console.log('Medical documents         :', medicalDocs);
    console.log('Health reports            :', healthReports);
    console.log('Profile pictures set      :', profilePics);
    console.log('---');
    console.log('Total images/files uploaded:', totalUploads);

    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
};

run();
