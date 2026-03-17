const axios = require('axios');
const FoodAdulteration = require('../models/FoodAdulteration');
const { robustJsonParse } = require('../utils/aiParser');

const ANTHROPIC_API_URL = 'https://api.anthropic.com/v1/messages';
const CLAUDE_MODEL = 'claude-haiku-4-5-20251001'; // Matches other services in the project

/**
 * Fetches food safety news/alerts from various sources using SerpAPI
 */
const fetchFoodSafetyData = async (query = 'food adulteration home testing methods FSSAI alerts India') => {
  try {
    const serpApiKey = process.env.SERP_API_KEY;
    if (!serpApiKey) {
      console.warn('⚠️ SERP_API_KEY is missing. Falling back to dummy search.');
      return [];
    }

    const response = await axios.get('https://serpapi.com/search', {
      params: {
        engine: 'google',
        q: query,
        api_key: serpApiKey,
        tbm: 'nws', // News results
        num: 15
      }
    });

    return response.data.news_results || [];
  } catch (error) {
    console.error('Error fetching food safety data:', error.message);
    return [];
  }
};

/**
 * Uses AI to process news results into structured food adulteration data
 */
const extractFoodSafetyInfo = async (newsResults) => {
  if (!newsResults || newsResults.length === 0) return [];

  const context = newsResults.map(res => `Title: ${res.title}\nSource: ${res.source}\nSnippet: ${res.snippet}`).join('\n\n');

  const prompt = `You are a food safety scientist. Analyze the news snippets and extract specific food adulteration data.
  
  CONTEXT:
  ${context}
  
  TASK:
  Return a JSON array of objects. EVERY object must follow this schema:
  {
    "foodName": "Name (e.g. Mustard Oil)",
    "adulterants": ["Specific chemicals/substances"],
    "homeTests": ["Step 1: ...", "Step 2: ..."],
    "healthRisks": ["Clear health impact"],
    "isAlertActive": true,
    "safetyScore": 0-100,
    "officialSource": "Source Name"
  }

  CRITICAL RULES:
  1. HOME TESTS: You MUST provide actual actionable home testing methods (like water test, iodine test, burning test, etc.). Do not give generic advice like "check labels". Be specific about the experiment.
  2. Return ONLY the JSON array. Start with [ and end with ]. 
  3. Combine all info for a single food item.`;

  try {
    const apiKey = process.env.ANTHROPIC_API_KEY;
    const response = await axios.post(
      ANTHROPIC_API_URL,
      {
        model: CLAUDE_MODEL,
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0
      },
      {
        headers: {
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
          'Content-Type': 'application/json'
        },
        timeout: 60000
      }
    );

    const content = response.data.content[0].text;
    
    // Improved parsing for multiple items or array
    let objects = [];
    
    // Try to find a JSON array first
    const arrayMatch = content.match(/\[[\s\S]*\]/);
    if (arrayMatch) {
      try {
        objects = robustJsonParse(arrayMatch[0]);
      } catch (e) {
        console.warn('Failed to parse as array, falling back to object matching');
      }
    }

    // If no array or array parse failed, find all { } blocks
    if (!objects || objects.length === 0) {
      const objectMatches = content.match(/\{[\s\S]*?\}/g);
      if (objectMatches) {
        objectMatches.forEach(objStr => {
          try {
            const parsed = robustJsonParse(objStr);
            if (parsed && parsed.foodName) {
              objects.push(parsed);
            }
          } catch (e) {
            console.error('Failed to parse individual object:', e.message);
          }
        });
      }
    }

    return Array.isArray(objects) ? objects : (objects ? [objects] : []);
  } catch (error) {
    console.error('AI processing error in food safety:', error.message);
    return [];
  }
};

/**
 * Main function to sync the database with latest food safety data
 */
const syncFoodSafetyDatabase = async () => {
  console.log('🔄 Starting Food Safety Database Sync...');
  
  try {
    // 1. Fetch search data
    const news = await fetchFoodSafetyData();
    
    // 2. Extract structured data using AI
    const safetyData = await extractFoodSafetyInfo(news);
    
    console.log(`🧠 Extracted info for ${safetyData.length} food items.`);

    // 3. Update database
    for (const item of safetyData) {
      await FoodAdulteration.findOneAndUpdate(
        { foodName: { $regex: new RegExp(`^${item.foodName}$`, 'i') } },
        {
          $set: {
            foodName: item.foodName,
            adulterants: item.adulterants,
            homeTests: item.homeTests,
            healthRisks: item.healthRisks,
            isAlertActive: item.isAlertActive,
            safetyScore: item.safetyScore,
            lastUpdated: new Date()
          }
        },
        { upsert: true, new: true }
      );
    }

    console.log('✅ Food safety database successfully updated.');
    return { success: true, count: safetyData.length };
  } catch (error) {
    console.error('❌ Food safety sync failed:', error);
    return { success: false, error: error.message };
  }
};

module.exports = {
  syncFoodSafetyDatabase,
  fetchFoodSafetyData,
  extractFoodSafetyInfo
};
