// Simple AI chat endpoint - no authentication required
module.exports = async (req, res) => {
  try {
    const { query, conversationHistory } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Query is required' 
      });
    }

    console.log('AI Chat request received for query:', query.substring(0, 50));

    // Check if API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return res.status(500).json({ 
        success: false,
        message: 'AI service not configured',
        error: 'Missing API key'
      });
    }

    // Prepare system prompt
    const systemPrompt = `You are a helpful medical AI assistant specializing in health and wellness. Provide helpful, accurate health information. Always remind users to consult healthcare professionals for medical decisions.`;

    // Build messages array
    const messages = [{ role: 'system', content: systemPrompt }];
    
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-6).forEach(msg => {
        if (msg.role && msg.content && !msg.content.includes('Hello')) {
          messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
        }
      });
    }
    
    messages.push({ role: 'user', content: query });

    const axios = require('axios');
    
    // Try multiple free models in order
    const freeModels = [
      'meta-llama/llama-3.1-8b-instruct:free',
      'google/gemini-2.0-flash-exp:free',
      'google/gemini-flash-1.5:free',
      'nousresearch/hermes-3-llama-3.1-405b:free'
    ];

    let aiResponse = null;
    let lastError = null;

    for (const model of freeModels) {
      try {
        console.log(`Trying model: ${model}`);
        
        const response = await axios.post(
          'https://openrouter.ai/api/v1/chat/completions',
          {
            model: model,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1500
          },
          {
            headers: {
              'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
              'Content-Type': 'application/json',
              'HTTP-Referer': process.env.CLIENT_URL || 'https://ai-diagnostic-steel.vercel.app',
              'X-Title': 'HealthAI Platform'
            },
            timeout: 25000
          }
        );

        if (response.data && response.data.choices && response.data.choices[0]) {
          aiResponse = response.data.choices[0].message.content;
          console.log(`Success with model: ${model}`);
          break;
        }
      } catch (error) {
        console.error(`Model ${model} failed:`, error.response?.data?.error || error.message);
        lastError = error;
        continue; // Try next model
      }
    }

    if (!aiResponse) {
      console.error('All models failed. Last error:', lastError?.response?.data || lastError?.message);
      throw new Error('All AI models failed: ' + (lastError?.response?.data?.error?.message || lastError?.message));
    }

    res.json({ 
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error('AI Chat error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    res.status(500).json({ 
      success: false,
      message: 'Failed to process AI chat request',
      error: error.response?.data?.error?.message || error.message,
      details: error.response?.data
    });
  }
};
