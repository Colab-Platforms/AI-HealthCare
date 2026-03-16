
const axios = require('axios');

async function testVitals() {
  const baseURL = 'http://localhost:5001/api';
  
  try {
    // We need a token. Let's assume there's a way to get one or use a test user.
    // Since I can't easily login, I'll try to trigger the 500 error by checking the logic.
    // Actually, I'll just check if the server is running and if it responds with 401 (meaning it's up).
    const res = await axios.get(`${baseURL}/health/dashboard`).catch(err => err.response);
    console.log('Dashboard status:', res?.status);
    console.log('Dashboard data:', res?.data);
  } catch (err) {
    console.error('Error:', err.message);
  }
}

testVitals();
