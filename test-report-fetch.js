const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test credentials
const testUser = {
  email: 'test001@example.com',
  password: 'Test@123456'
};

let token = null;
let userId = null;

async function login() {
  try {
    console.log('\n[TEST] Logging in...');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    token = response.data.token;
    userId = response.data.user._id;
    console.log('[TEST] ✅ Login successful');
    console.log('[TEST] Token:', token.substring(0, 20) + '...');
    console.log('[TEST] User ID:', userId);
    return true;
  } catch (error) {
    console.error('[TEST] ❌ Login failed:', error.response?.data?.message || error.message);
    return false;
  }
}

async function getReports() {
  try {
    console.log('\n[TEST] Fetching reports...');
    const response = await axios.get(`${API_URL}/health/reports`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('[TEST] ✅ Reports fetched');
    console.log('[TEST] Total reports:', response.data.length);
    
    if (response.data.length > 0) {
      const latestReport = response.data[0];
      console.log('[TEST] Latest report ID:', latestReport._id);
      console.log('[TEST] Report type:', latestReport.reportType);
      console.log('[TEST] Report status:', latestReport.status);
      console.log('[TEST] Has AI Analysis:', !!latestReport.aiAnalysis);
      
      if (latestReport.aiAnalysis) {
        console.log('[TEST] AI Analysis keys:', Object.keys(latestReport.aiAnalysis));
        console.log('[TEST] Health Score:', latestReport.aiAnalysis.healthScore);
        console.log('[TEST] Summary:', latestReport.aiAnalysis.summary?.substring(0, 100));
      }
      
      return latestReport._id;
    }
    return null;
  } catch (error) {
    console.error('[TEST] ❌ Failed to fetch reports:', error.response?.data?.message || error.message);
    return null;
  }
}

async function getReportById(reportId) {
  try {
    console.log(`\n[TEST] Fetching report ${reportId}...`);
    const response = await axios.get(`${API_URL}/health/reports/${reportId}`, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    console.log('[TEST] ✅ Report fetched');
    console.log('[TEST] Response keys:', Object.keys(response.data));
    console.log('[TEST] Report exists:', !!response.data.report);
    console.log('[TEST] Recommended doctors:', response.data.recommendedDoctors?.length || 0);
    
    if (response.data.report) {
      const report = response.data.report;
      console.log('[TEST] Report ID:', report._id);
      console.log('[TEST] Report type:', report.reportType);
      console.log('[TEST] Report status:', report.status);
      console.log('[TEST] Has AI Analysis:', !!report.aiAnalysis);
      
      if (report.aiAnalysis) {
        console.log('[TEST] AI Analysis keys:', Object.keys(report.aiAnalysis));
        console.log('[TEST] Health Score:', report.aiAnalysis.healthScore);
        console.log('[TEST] Summary:', report.aiAnalysis.summary?.substring(0, 100));
        console.log('[TEST] Metrics:', Object.keys(report.aiAnalysis.metrics || {}));
        console.log('[TEST] Deficiencies:', report.aiAnalysis.deficiencies?.length || 0);
        console.log('[TEST] Diet Plan:', !!report.aiAnalysis.dietPlan);
        console.log('[TEST] Fitness Plan:', !!report.aiAnalysis.fitnessPlan);
      } else {
        console.log('[TEST] ⚠️  No AI Analysis in report');
        console.log('[TEST] Report object keys:', Object.keys(report));
      }
    }
  } catch (error) {
    console.error('[TEST] ❌ Failed to fetch report:', error.response?.data?.message || error.message);
  }
}

async function main() {
  console.log('=== REPORT FETCH TEST ===');
  
  const loggedIn = await login();
  if (!loggedIn) return;
  
  const reportId = await getReports();
  if (reportId) {
    await getReportById(reportId);
  } else {
    console.log('[TEST] ⚠️  No reports found');
  }
}

main().catch(console.error);
