const axios = require('axios');
require('dotenv').config({ path: './server/.env' });

const testOpenRouter = async () => {
  console.log('Testing OpenRouter API...');
  console.log('API Key present:', !!process.env.OPENROUTER_API_KEY);
  console.log('API Key:', process.env.OPENROUTER_API_KEY?.substring(0, 30) + '...');
  
  const models = [
    'google/gemini-2.0-flash-exp:free',
    'meta-llama/llama-3.1-8b-instruct:free',
    'mistralai/mistral-7b-instruct:free'
  ];
  
  for (const model of models) {
    try {
      console.log(`\nTesting model: ${model}`);
      const response = await axios.post(
        'https://openrouter.ai/api/v1/chat/completions',
        {
          model: model,
          messages: [
            { role: 'user', content: 'Say "Hello, this is a test"' }
          ],
          max_tokens: 100
        },
        {
          headers: {
            'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
            'Content-Type': 'application/json',
            'HTTP-Referer': 'http://localhost:5000',
            'X-Title': 'Test'
          },
          timeout: 30000
        }
      );
      
      console.log(`✅ ${model} - SUCCESS`);
      console.log('Response:', response.data.choices[0].message.content);
      return;
    } catch (error) {
      console.log(`❌ ${model} - FAILED`);
      console.log('Status:', error.response?.status);
      console.log('Error:', error.response?.data?.error || error.message);
    }
  }
  
  console.log('\n❌ All models failed!');
};

testOpenRouter();
