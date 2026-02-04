const axios = require('axios');

async function testOpenRouter() {
  try {
    console.log('Testing OpenRouter API...');
    
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'anthropic/claude-3.5-sonnet',
        messages: [
          { role: 'system', content: 'You are a helpful assistant.' },
          { role: 'user', content: 'Say "Hello, API is working!"' }
        ]
      },
      {
        headers: {
          'Authorization': `Bearer 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`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'HealthAI Test'
        },
        timeout: 30000
      }
    );

    console.log('✅ API Response:', response.data.choices[0].message.content);
    console.log('✅ OpenRouter API is working!');
  } catch (error) {
    console.error('❌ API Error:', error.response?.data || error.message);
  }
}

testOpenRouter();
