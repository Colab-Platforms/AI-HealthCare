// Quick script to check if comparison data exists in your reports
require('dotenv').config();
const mongoose = require('mongoose');
const HealthReport = require('./models/HealthReport');

async function checkComparisonData() {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ Connected to MongoDB\n');

    // Get all reports
    const reports = await HealthReport.find()
      .sort({ createdAt: -1 })
      .select('reportType createdAt comparison patientName status')
      .limit(10);

    console.log(`📊 Found ${reports.length} reports\n`);

    reports.forEach((report, idx) => {
      console.log(`\n${idx + 1}. Report ID: ${report._id}`);
      console.log(`   Type: ${report.reportType}`);
      console.log(`   Patient: ${report.patientName || 'N/A'}`);
      console.log(`   Date: ${report.createdAt.toLocaleDateString()}`);
      console.log(`   Status: ${report.status}`);
      console.log(`   Has Comparison: ${!!report.comparison ? '✅ YES' : '❌ NO'}`);
      
      if (report.comparison) {
        console.log(`   Comparison Data:`);
        console.log(`     - Previous Report: ${report.comparison.previousReportId}`);
        console.log(`     - Previous Date: ${new Date(report.comparison.previousReportDate).toLocaleDateString()}`);
        console.log(`     - Overall Trend: ${report.comparison.data?.overallTrend || 'N/A'}`);
        console.log(`     - Improvements: ${report.comparison.data?.improvements?.length || 0}`);
        console.log(`     - Concerns: ${report.comparison.data?.concerns?.length || 0}`);
      }
    });

    // Check for reports of same type
    console.log('\n\n📋 Report Type Summary:');
    const typeGroups = {};
    reports.forEach(r => {
      if (!typeGroups[r.reportType]) typeGroups[r.reportType] = [];
      typeGroups[r.reportType].push(r);
    });

    Object.entries(typeGroups).forEach(([type, reps]) => {
      console.log(`\n${type}: ${reps.length} reports`);
      if (reps.length > 1) {
        console.log('  ✅ Multiple reports - comparison should be available');
      } else {
        console.log('  ⚠️  Only 1 report - need another to generate comparison');
      }
    });

    // Check latest report specifically
    console.log('\n\n🔍 Latest Report Details:');
    const latest = reports[0];
    if (latest) {
      console.log(`Report Type: ${latest.reportType}`);
      console.log(`Has Comparison: ${!!latest.comparison ? '✅ YES' : '❌ NO'}`);
      
      if (!latest.comparison && reports.length > 1) {
        const previousSameType = reports.find(
          r => r.reportType === latest.reportType && r._id.toString() !== latest._id.toString()
        );
        
        if (previousSameType) {
          console.log('\n⚠️  ISSUE FOUND:');
          console.log('   - Latest report has no comparison');
          console.log('   - But previous report of same type exists');
          console.log('   - Comparison should have been generated');
          console.log('\n💡 SOLUTION: Upload a new report to trigger comparison');
        } else {
          console.log('\n✅ No issue - latest report is the only one of its type');
        }
      }
    }

    await mongoose.disconnect();
    console.log('\n\n✅ Check complete');
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

checkComparisonData();
