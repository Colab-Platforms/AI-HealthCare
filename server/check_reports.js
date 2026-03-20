const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const HealthReport = require('./models/HealthReport');
const User = require('./models/User');
const connectDB = require('./config/db');

async function checkReports() {
    await connectDB();
    try {
        const user = await User.findOne({});
        if (!user) {
            console.log("No users found");
            process.exit(0);
        }
        console.log(`Checking reports for User: ${user.name} (${user._id})`);
        
        const reports = await HealthReport.find({ user: user._id }).sort({ createdAt: -1 });
        console.log(`Found ${reports.length} reports.`);
        
        reports.forEach((r, i) => {
            console.log(`Report ${i+1}: ID: ${r._id}, Type: ${r.reportType}, Date: ${r.createdAt}`);
            console.log(`  aiAnalysis exists: ${!!r.aiAnalysis}`);
            if (r.aiAnalysis) {
                console.log(`  Diet plan exists in AI analysis: ${!!r.aiAnalysis.dietPlan}`);
            }
        });
        
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

checkReports();
