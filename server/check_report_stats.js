const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const HealthReport = require('./models/HealthReport');
const connectDB = require('./config/db');

async function checkReportStats() {
    await connectDB();
    try {
        const stats = await HealthReport.aggregate([
            { $group: { _id: "$user", count: { $sum: 1 } } }
        ]);
        console.log(`Found ${stats.length} users with reports.`);
        stats.forEach(s => {
            console.log(`User: ${s._id}, Total Reports: ${s.count}`);
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkReportStats();
