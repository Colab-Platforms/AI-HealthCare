/**
 * Direct GPT-4 API Test
 * Tests if OpenRouter GPT-4 API is working properly
 */

require('dotenv').config({ path: './server/.env' });
const axios = require('axios');

const OPENROUTER_API_URL = 'https://openrouter.ai/api/v1/chat/completions';
const AI_MODEL = 'openai/gpt-4';

async function testGPT4() {
  console.log('🧪 Testing GPT-4 API Connection...\n');
  
  // Check API key
  if (!process.env.OPENROUTER_API_KEY) {
    console.error('❌ OPENROUTER_API_KEY not found in .env file');
    return;
  }
  
  console.log('✅ API Key found:', process.env.OPENROUTER_API_KEY.substring(0, 20) + '...');
  console.log('🔄 Model:', AI_MODEL);
  console.log('🔄 Making test request...\n');
  
  try {
    const response = await axios.post(
      OPENROUTER_API_URL,
      {
        model: AI_MODEL,
        messages: [
          { 
            role: 'system', 
            content: 'You are a helpful assistant. Respond with valid JSON only.' 
          },
          { 
            role: 'user', 
            content: 'Return this JSON: {"test": "success", "model": "gpt-4", "status": "working"}' 
          }
        ],
        temperature: 0,
        max_tokens: 100,
        seed: 42,
        top_p: 1
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.APP_URL || 'http://localhost:5173',
          'X-Title': 'HealthAI Platform Test'
        },
        timeout: 30000
      }
    );
    
    console.log('✅ API Response received!\n');
    console.log('📊 Response Details:');
    console.log('- Model used:', response.data.model);
    console.log('- ID:', response.data.id);
    console.log('- Created:', new Date(response.data.created * 1000).toLocaleString());
    console.log('\n📝 Content:');
    console.log(response.data.choices[0].message.content);
    console.log('\n💰 Usage:');
    console.log('- Prompt tokens:', response.data.usage?.prompt_tokens);
    console.log('- Completion tokens:', response.data.usage?.completion_tokens);
    console.log('- Total tokens:', response.data.usage?.total_tokens);
    
    console.log('\n✅ GPT-4 API is working correctly!');
    
  } catch (error) {
    console.error('\n❌ API Test Failed!\n');
    console.error('Error Details:');
    console.error('- Message:', error.message);
    console.error('- Status:', error.response?.status);
    console.error('- Status Text:', error.response?.statusText);
    console.error('- Error Data:', JSON.stringify(error.response?.data, null, 2));
    
    if (error.response?.status === 401) {
      console.error('\n⚠️  Authentication Error: Check your API key');
    } else if (error.response?.status === 402) {
      console.error('\n⚠️  Payment Required: Your API credits may be exhausted');
    } else if (error.response?.status === 429) {
      console.error('\n⚠️  Rate Limit: Too many requests');
    } else if (error.code === 'ECONNABORTED') {
      console.error('\n⚠️  Timeout: Request took too long');
    }
  }
}

// Run the test
testGPT4();
