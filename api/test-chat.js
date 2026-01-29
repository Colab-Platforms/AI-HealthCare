// Test script to verify the chat API is working
const axios = require('axios');

const testChat = async () => {
  try {
    const response = await axios.post('http://localhost:5000/api/chat', {
      query: 'What is vitamin D?',
      conversationHistory: [],
      userReports: []
    });

    console.log('✓ Chat API Response:');
    console.log(JSON.stringify(response.data, null, 2));
  } catch (error) {
    console.error('✗ Chat API Error:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.message);
    console.error('Data:', error.response?.data);
  }
};

testChat();
