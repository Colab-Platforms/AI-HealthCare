const mongoose = require('mongoose');
const dotenv = require('dotenv');
dotenv.config();
const HealthReport = require('./models/HealthReport');
const connectDB = require('./config/db');

async function checkUserReports(id) {
    await connectDB();
    try {
        const reports = await HealthReport.find({ user: id }).sort({ createdAt: -1 });
        console.log(`Found ${reports.length} reports for user ${id}`);
        reports.forEach((r, i) => {
            console.log(`Report ${i+1}: ID: ${r._id}, Created: ${r.createdAt}, Status: ${r.status}`);
        });
    } catch (err) {
        console.error(err);
    } finally {
        mongoose.connection.close();
    }
}

const id = "69412a3b2592607a98c5afea";
checkUserReports(id);
