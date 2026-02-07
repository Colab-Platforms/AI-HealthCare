/**
 * Test Script to Verify AI Consistency
 * 
 * This script tests that the same report produces the same results
 * when analyzed multiple times.
 */

const axios = require('axios');
const fs = require('fs');
const FormData = require('form-data');

const API_URL = 'http://localhost:5000/api';
const TEST_REPORT_PATH = './server/uploads/report-1770356012832-237102396.pdf'; // Use any existing report

async function login() {
  try {
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: 'test@example.com',
      password: 'password123'
    });
    return response.data.token;
  } catch (error) {
    console.error('Login failed:', error.response?.data || error.message);
    throw error;
  }
}

async function uploadReport(token, reportPath) {
  try {
    const form = new FormData();
    form.append('report', fs.createReadStream(reportPath));
    form.append('reportType', 'Blood Test');

    const response = await axios.post(`${API_URL}/health/upload`, form, {
      headers: {
        ...form.getHeaders(),
        'Authorization': `Bearer ${token}`
      }
    });

    return response.data.report;
  } catch (error) {
    console.error('Upload failed:', error.response?.data || error.message);
    throw error;
  }
}

async function testConsistency() {
  console.log('🧪 Testing AI Consistency...\n');

  // Check if test report exists
  if (!fs.existsSync(TEST_REPORT_PATH)) {
    console.error('❌ Test report not found:', TEST_REPORT_PATH);
    console.log('Please update TEST_REPORT_PATH to point to an existing report');
    return;
  }

  try {
    // Login
    console.log('1️⃣ Logging in...');
    const token = await login();
    console.log('✅ Login successful\n');

    // Upload same report 3 times
    const results = [];
    for (let i = 1; i <= 3; i++) {
      console.log(`${i}️⃣ Upload #${i}...`);
      const report = await uploadReport(token, TEST_REPORT_PATH);
      results.push({
        uploadNumber: i,
        reportId: report._id,
        patientName: report.patientName || report.aiAnalysis?.patientName,
        healthScore: report.aiAnalysis?.healthScore,
        reportDate: report.reportDate || report.aiAnalysis?.reportDate,
        metricsCount: Object.keys(report.aiAnalysis?.metrics || {}).length,
        deficienciesCount: report.aiAnalysis?.deficiencies?.length || 0
      });
      console.log(`✅ Upload #${i} complete`);
      console.log(`   - Patient Name: ${results[i-1].patientName}`);
      console.log(`   - Health Score: ${results[i-1].healthScore}`);
      console.log(`   - Metrics: ${results[i-1].metricsCount}`);
      console.log(`   - Deficiencies: ${results[i-1].deficienciesCount}\n`);
      
      // Wait 2 seconds between uploads
      if (i < 3) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // Compare results
    console.log('\n📊 Consistency Check:\n');
    
    const healthScores = results.map(r => r.healthScore);
    const patientNames = results.map(r => r.patientName);
    const metricsCounts = results.map(r => r.metricsCount);
    
    const healthScoresMatch = healthScores.every(score => score === healthScores[0]);
    const patientNamesMatch = patientNames.every(name => name === patientNames[0]);
    const metricsCountsMatch = metricsCounts.every(count => count === metricsCounts[0]);
    
    console.log(`Health Scores: ${healthScores.join(', ')}`);
    console.log(`${healthScoresMatch ? '✅' : '❌'} Health scores are ${healthScoresMatch ? 'CONSISTENT' : 'INCONSISTENT'}\n`);
    
    console.log(`Patient Names: ${patientNames.join(', ')}`);
    console.log(`${patientNamesMatch ? '✅' : '❌'} Patient names are ${patientNamesMatch ? 'CONSISTENT' : 'INCONSISTENT'}\n`);
    
    console.log(`Metrics Counts: ${metricsCounts.join(', ')}`);
    console.log(`${metricsCountsMatch ? '✅' : '❌'} Metrics counts are ${metricsCountsMatch ? 'CONSISTENT' : 'INCONSISTENT'}\n`);
    
    if (healthScoresMatch && patientNamesMatch && metricsCountsMatch) {
      console.log('🎉 SUCCESS! All results are consistent!\n');
    } else {
      console.log('⚠️  WARNING! Results are inconsistent. Check AI configuration.\n');
    }
    
    // Detailed comparison
    console.log('📋 Detailed Results:');
    console.table(results);
    
  } catch (error) {
    console.error('❌ Test failed:', error.message);
  }
}

// Run the test
testConsistency();
