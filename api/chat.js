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

    // Check if API key is configured
    if (!process.env.OPENROUTER_API_KEY) {
      console.error('OPENROUTER_API_KEY not configured');
      return res.status(500).json({ 
        success: false,
        message: 'AI service not configured',
        error: 'Missing API key'
      });
    }

    console.log('AI Chat request received');

    // Prepare system prompt
    const systemPrompt = `You are a helpful medical AI assistant specializing in health and wellness. 

Provide helpful, accurate health information about:
- Understanding health reports and medical terms
- Vitamin and mineral deficiencies
- General health guidance
- Diet and lifestyle recommendations
- Symptom information

Always remind users to consult healthcare professionals for medical diagnosis and treatment decisions.`;

    // Build messages array for AI
    const messages = [
      { role: 'system', content: systemPrompt }
    ];

    // Add conversation history if provided (last 10 messages)
    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-10).forEach(msg => {
        if (msg.role && msg.content && !msg.content.includes('Hello')) {
          messages.push({ 
            role: msg.role === 'user' ? 'user' : 'assistant', 
            content: msg.content 
          });
        }
      });
    }

    // Add current query
    messages.push({ role: 'user', content: query });

    console.log('Calling OpenRouter API...');

    // Call OpenRouter API with FREE model
    const axios = require('axios');
    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages,
        temperature: 0.7,
        max_tokens: 2000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': process.env.CLIENT_URL || 'https://ai-diagnostic-steel.vercel.app',
          'X-Title': 'HealthAI Platform'
        },
        timeout: 30000
      }
    );

    const aiResponse = response.data.choices[0].message.content;
    console.log('OpenRouter API success');

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
      error: error.response?.data?.error?.message || error.message
    });
  }
};
