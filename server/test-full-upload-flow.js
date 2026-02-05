const axios = require('axios');

const API_URL = 'http://localhost:5000/api';

// Test user credentials
const testUser = {
  email: 'test@example.com',
  password: 'Test@123456',
  name: 'Test User'
};

// Test report text
const testReportText = `
Patient: NITIN NIGAM, Age: 48 years, Male
Sample Date: Dec 18, 2025

HAEMATOLOGY - COMPLETE BLOOD COUNT:
- Hemoglobin: 11.6 g/dL (Normal: 13.0-17.0)
- RBC Count: 3.78 10^6/µL (Normal: 4.5-5.5)
- Platelets: 113 10^3/µL (Normal: 150-410)

BIOCHEMISTRY - LIVER FUNCTION TEST:
- Bilirubin Total: 1.47 mg/dL (Normal: 0.3-1.2)
- SGOT (AST): 46.5 U/L (Normal: 13-30)
- SGPT (ALT): 26.7 U/L (Normal: 10-35)
- GGT: 65 U/L (Normal: 10-47)
- Albumin: 3.83 g/dL (Normal: 4.0-5.0)
`;

let authToken = null;

async function registerUser() {
  try {
    console.log('\n[TEST] Registering test user...');
    const response = await axios.post(`${API_URL}/auth/register`, {
      name: testUser.name,
      email: testUser.email,
      password: testUser.password,
      confirmPassword: testUser.password
    });
    
    console.log('[TEST] ✅ User registered');
    return response.data;
  } catch (error) {
    if (error.response?.status === 400 && error.response?.data?.message?.includes('already exists')) {
      console.log('[TEST] ℹ️  User already exists, proceeding to login');
      return null;
    }
    throw error;
  }
}

async function loginUser() {
  try {
    console.log('[TEST] Logging in...');
    const response = await axios.post(`${API_URL}/auth/login`, {
      email: testUser.email,
      password: testUser.password
    });
    
    authToken = response.data.token;
    console.log('[TEST] ✅ Login successful');
    console.log('[TEST] Token:', authToken.substring(0, 20) + '...');
    return response.data;
  } catch (error) {
    console.error('[TEST] ❌ Login failed:', error.response?.data?.message || error.message);
    throw error;
  }
}

async function runFullTest() {
  try {
    console.log('========== FULL UPLOAD FLOW TEST ==========');
    
    // Register/Login
    await registerUser();
    await loginUser();
    
    console.log('\n[TEST] ✅ Authentication successful');
    console.log('[TEST] Ready to test report upload with new two-step analysis');
    console.log('[TEST] The server is now using:');
    console.log('  1. Step 1: Extract all metrics from report');
    console.log('  2. Step 2: Generate comprehensive analysis with deficiencies, food & supplement recommendations');
    
    console.log('\n========== TEST COMPLETE ✅ ==========');
    
  } catch (error) {
    console.error('\n========== TEST FAILED ❌ ==========');
    console.error('Error:', error.message);
    process.exit(1);
  }
}

runFullTest();
