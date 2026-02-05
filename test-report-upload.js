const axios = require('axios');
const fs = require('fs');
const path = require('path');
const FormData = require('form-data');

// Test configuration
const API_BASE = 'http://localhost:5000/api';
const TEST_TOKEN = process.env.TEST_TOKEN || 'test-token';

// Sample test report text
const sampleReportText = `
HEALTH REPORT - BLOOD TEST ANALYSIS
Date: 2024-01-31
Patient: Test Patient

HEMOGLOBIN: 13.5 g/dL (Normal: 12-16)
BLOOD PRESSURE: 120/80 mmHg (Normal)
VITAMIN D: 25 ng/mL (Low: <30)
VITAMIN B12: 350 pg/mL (Borderline: 200-900)
IRON: 65 µg/dL (Low: 60-170)

FINDINGS:
- Slightly low vitamin D levels
- Borderline B12 levels
- Iron levels at lower end of normal

RECOMMENDATIONS:
- Increase sun exposure
- Consider vitamin D supplementation
- Monitor B12 levels
- Increase iron-rich foods in diet
`;

async function testReportUpload() {
  console.log('\n========== REPORT UPLOAD TEST START ==========\n');
  
  try {
    // Create a temporary PDF file for testing
    const testFilePath = path.join(__dirname, 'test-report.txt');
    fs.writeFileSync(testFilePath, sampleReportText);
    
    console.log('[TEST] Created test report file:', testFilePath);
    console.log('[TEST] File size:', fs.statSync(testFilePath).size, 'bytes');
    
    // Create FormData
    const form = new FormData();
    form.append('report', fs.createReadStream(testFilePath));
    form.append('reportType', 'Blood Test');
    
    console.log('[TEST] Sending upload request to:', `${API_BASE}/health/upload`);
    console.log('[TEST] Using token:', TEST_TOKEN.substring(0, 20) + '...');
    
    // Make request
    const response = await axios.post(
      `${API_BASE}/health/upload`,
      form,
      {
        headers: {
          ...form.getHeaders(),
          'Authorization': `Bearer ${TEST_TOKEN}`
        },
        timeout: 30000
      }
    );
    
    console.log('\n[TEST] ✅ Upload successful!');
    console.log('[TEST] Response status:', response.status);
    console.log('[TEST] Report ID:', response.data.report._id);
    console.log('[TEST] Report status:', response.data.report.status);
    console.log('[TEST] Health score:', response.data.report.aiAnalysis?.healthScore);
    console.log('[TEST] Summary:', response.data.report.aiAnalysis?.summary?.substring(0, 100) + '...');
    
    // Clean up
    fs.unlinkSync(testFilePath);
    console.log('\n[TEST] Cleaned up test file');
    
  } catch (error) {
    console.error('\n[TEST] ❌ Upload failed!');
    console.error('[TEST] Error message:', error.message);
    if (error.response) {
      console.error('[TEST] Status:', error.response.status);
      console.error('[TEST] Response:', error.response.data);
    }
    if (error.code) {
      console.error('[TEST] Error code:', error.code);
    }
  }
  
  console.log('\n========== REPORT UPLOAD TEST END ==========\n');
}

// Run test
testReportUpload();
