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

    console.log('AI Chat request received');

    // Try OpenRouter first, fallback to template if it fails
    let aiResponse = null;
    
    if (process.env.OPENROUTER_API_KEY) {
      try {
        const axios = require('axios');
        
        // Prepare system prompt
        const systemPrompt = `You are a helpful medical AI assistant specializing in health and wellness. Provide helpful, accurate health information. Always remind users to consult healthcare professionals for medical decisions.`;

        // Build messages array
        const messages = [{ role: 'system', content: systemPrompt }];
        
        if (conversationHistory && Array.isArray(conversationHistory)) {
          conversationHistory.slice(-10).forEach(msg => {
            if (msg.role && msg.content && !msg.content.includes('Hello')) {
              messages.push({ role: msg.role === 'user' ? 'user' : 'assistant', content: msg.content });
            }
          });
        }
        
        messages.push({ role: 'user', content: query });

        console.log('Calling OpenRouter API...');
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

        aiResponse = response.data.choices[0].message.content;
        console.log('OpenRouter API success');
      } catch (apiError) {
        console.error('OpenRouter API failed:', apiError.response?.data || apiError.message);
        // Will use fallback below
      }
    }

    // Fallback to intelligent template responses if API fails
    if (!aiResponse) {
      console.log('Using fallback response generator');
      aiResponse = generateIntelligentResponse(query);
    }

    res.json({ 
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      source: aiResponse.includes('consult') ? 'template' : 'ai'
    });
  } catch (error) {
    console.error('AI Chat error:', error.message);
    
    // Final fallback
    res.json({ 
      success: true,
      response: generateIntelligentResponse(req.body.query || ''),
      timestamp: new Date().toISOString(),
      source: 'template'
    });
  }
};

function generateIntelligentResponse(query) {
  const lowerQuery = query.toLowerCase();
  
  if (lowerQuery.includes('vitamin d')) {
    return `**Vitamin D Information:**\n\nVitamin D is essential for bone health, immune function, and overall wellbeing.\n\n**Normal Range:** 30-100 ng/mL\n\n**If Low:**\n• Get 15-20 minutes of morning sunlight daily\n• Eat fatty fish (salmon, mackerel), eggs, fortified milk\n• Consider supplements after consulting your doctor\n\n**Symptoms of Deficiency:**\n• Fatigue and tiredness\n• Bone pain or weakness\n• Frequent infections\n• Mood changes\n\n**Important:** Please consult with a healthcare professional for personalized medical advice.`;
  }
  
  if (lowerQuery.includes('iron') || lowerQuery.includes('hemoglobin')) {
    return `**Iron & Hemoglobin Information:**\n\nIron is crucial for producing hemoglobin, which carries oxygen in your blood.\n\n**Normal Ranges:**\n• Hemoglobin: 12-17 g/dL\n• Iron: 60-170 mcg/dL\n\n**To Increase Iron:**\n• Red meat, chicken, fish\n• Spinach, dal, beans\n• Eat with Vitamin C foods (citrus, tomatoes)\n• Avoid tea/coffee with meals\n\n**Symptoms of Low Iron:**\n• Extreme fatigue\n• Pale skin\n• Shortness of breath\n• Cold hands and feet\n• Dizziness\n\n**Important:** Consult your doctor if symptoms persist or for proper diagnosis.`;
  }

  if (lowerQuery.includes('vitamin b12') || lowerQuery.includes('b12')) {
    return `**Vitamin B12 Information:**\n\nB12 is essential for nerve function, red blood cell formation, and DNA synthesis.\n\n**Normal Range:** 200-900 pg/mL\n\n**Food Sources:**\n• Eggs, milk, yogurt, cheese\n• Fish, chicken, meat\n• Fortified cereals\n\n**Symptoms of Deficiency:**\n• Weakness and fatigue\n• Numbness or tingling\n• Memory problems\n• Pale skin\n\n**Note:** Vegetarians may need supplements. Consult a healthcare professional for guidance.`;
  }

  if (lowerQuery.includes('diet') || lowerQuery.includes('food') || lowerQuery.includes('eat')) {
    return `**Healthy Diet Guidelines:**\n\n**Balanced Meals Should Include:**\n• Proteins: Eggs, dal, paneer, chicken, fish\n• Carbs: Whole grains, rice, roti\n• Healthy fats: Nuts, seeds, ghee (in moderation)\n• Fruits & vegetables: 5 servings daily\n\n**General Tips:**\n• Stay hydrated (8-10 glasses water daily)\n• Eat at regular times\n• Limit processed foods and sugar\n• Include variety of colors in meals\n• Get 15 mins of sunlight daily\n\n**For personalized diet plans based on your health data, check your Diet Plan page.**\n\nConsult a nutritionist for specific dietary needs.`;
  }

  return `Thank you for your question about "${query}".\n\nI'm here to help with:\n• Understanding health reports and medical terms\n• Vitamin and mineral deficiencies\n• General health guidance\n• Diet and lifestyle recommendations\n• Symptom information\n\n**Important:** I provide general information only. For medical diagnosis and treatment, please consult with a healthcare professional.\n\nCould you please provide more specific details about what you'd like to know?`;
}
