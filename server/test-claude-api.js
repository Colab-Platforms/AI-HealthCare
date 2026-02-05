const axios = require('axios');
const dotenv = require('dotenv');

dotenv.config();

async function testClaudeAPI() {
  try {
    console.log('Testing Claude API via OpenRouter...');
    console.log('API Key:', process.env.OPENROUTER_API_KEY?.substring(0, 20) + '...');
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Claude API is working!"' }
        ],
        temperature: 0.1,
        max_tokens: 100
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'HealthAI Test'
        },
        timeout: 30000
      }
    );

    console.log('✅ Claude API Response:', response.data.choices[0].message.content);
    console.log('✅ Claude API is working!');
  } catch (error) {
    console.error('❌ Claude API Error:');
    console.error('Status:', error.response?.status);
    console.error('Message:', error.response?.data?.error?.message || error.message);
    console.error('Full error:', error.response?.data);
  }
}

testClaudeAPI();
