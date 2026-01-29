// Simple AI chat endpoint - no authentication required
module.exports = async (req, res) => {
  try {
    const { query, conversationHistory, userReports } = req.body;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ 
        success: false,
        message: 'Query is required' 
      });
    }

    console.log('AI Chat request received for query:', query.substring(0, 50));

    // Prepare system prompt with report context
    let systemPrompt = `You are a helpful medical AI assistant specializing in health and wellness. Provide helpful, accurate health information. Always remind users to consult healthcare professionals for medical decisions.`;
    
    // Add report context if available
    if (userReports && userReports.length > 0) {
      const reportContext = userReports.map(report => {
        const date = new Date(report.date).toLocaleDateString();
        const metrics = report.metrics ? JSON.stringify(report.metrics) : '';
        return `Report: ${report.type || 'Health Report'} (${date})\nAnalysis: ${report.analysis || 'No analysis'}\nMetrics: ${metrics}`;
      }).join('\n\n');
      
      systemPrompt += `\n\nUser's Health Reports:\n${reportContext}\n\nUse this information to provide personalized responses based on their actual health data.`;
    }

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
    let aiResponse = null;
    let lastError = null;
    let isRateLimited = false;

    // Try OpenRouter API if key is configured
    if (process.env.OPENROUTER_API_KEY) {
      // Use Claude model from OpenRouter (as per requirements)
      const models = [
        'anthropic/claude-3.5-sonnet',
        'anthropic/claude-3-sonnet'
      ];

      for (const model of models) {
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
          const status = error.response?.status;
          const errorMsg = error.response?.data?.error?.message || error.message;
          
          console.error(`Model ${model} failed (${status}):`, errorMsg);
          
          // Check if rate limited
          if (status === 429) {
            isRateLimited = true;
            console.log('Rate limit detected, will use fallback');
            break; // Don't try other models if rate limited
          }
          
          lastError = error;
          continue;
        }
      }
    }

    // If OpenRouter failed or rate limited, use intelligent fallback
    if (!aiResponse) {
      console.log('Using intelligent fallback response');
      aiResponse = generateIntelligentResponse(query, conversationHistory);
    }

    res.json({ 
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      mode: aiResponse.includes('⚠️') ? 'fallback' : 'ai'
    });

  } catch (error) {
    console.error('AI Chat error:', {
      message: error.message,
      response: error.response?.data,
      status: error.response?.status
    });
    
    // Even on error, provide a helpful response
    const fallbackResponse = generateIntelligentResponse(req.body.query, req.body.conversationHistory);
    
    res.json({ 
      success: true,
      response: fallbackResponse,
      timestamp: new Date().toISOString(),
      mode: 'fallback'
    });
  }
};

// Intelligent fallback response generator
function generateIntelligentResponse(query, conversationHistory = []) {
  const lowerQuery = query.toLowerCase();
  
  // Health metrics and lab values
  if (lowerQuery.includes('vitamin d') || lowerQuery.includes('vitamin-d')) {
    return `**Vitamin D Information:**

Vitamin D is essential for bone health, immune function, and overall wellbeing.

**Normal Range:** 30-100 ng/mL
• Deficient: <20 ng/mL
• Insufficient: 20-30 ng/mL
• Optimal: 30-100 ng/mL

**If Your Levels Are Low:**
• Get 15-20 minutes of morning sunlight daily
• Eat fatty fish (salmon, mackerel), egg yolks, fortified milk
• Consider supplements (consult your doctor for dosage)

**Symptoms of Deficiency:**
• Fatigue and tiredness
• Bone pain or muscle weakness
• Frequent infections
• Mood changes or depression

**Important:** Always consult with your healthcare provider for personalized advice and treatment.`;
  }
  
  if (lowerQuery.includes('iron') || lowerQuery.includes('hemoglobin') || lowerQuery.includes('anemia')) {
    return `**Iron & Hemoglobin Information:**

Iron is crucial for producing hemoglobin, which carries oxygen in your blood.

**Normal Ranges:**
• Hemoglobin: 12-17 g/dL (varies by age/gender)
• Iron: 60-170 mcg/dL
• Ferritin: 12-300 ng/mL

**To Increase Iron Levels:**
• Eat iron-rich foods: red meat, chicken, fish, spinach, dal, beans
• Pair with Vitamin C: citrus fruits, tomatoes, bell peppers
• Avoid tea/coffee with meals (reduces absorption)
• Cook in iron utensils

**Symptoms of Low Iron:**
• Extreme fatigue
• Pale skin
• Shortness of breath
• Cold hands and feet
• Dizziness or headaches

**Important:** Consult your doctor before taking iron supplements as too much iron can be harmful.`;
  }

  if (lowerQuery.includes('vitamin b12') || lowerQuery.includes('b12')) {
    return `**Vitamin B12 Information:**

B12 is essential for nerve function, red blood cell formation, and DNA synthesis.

**Normal Range:** 200-900 pg/mL
• Deficient: <200 pg/mL
• Borderline: 200-300 pg/mL

**Food Sources:**
• Eggs, milk, yogurt, cheese
• Fish (salmon, tuna)
• Chicken and meat
• Fortified cereals

**Symptoms of Deficiency:**
• Fatigue and weakness
• Tingling in hands/feet
• Memory problems
• Mood changes

**Note:** Vegetarians and vegans are at higher risk and may need supplements.

**Important:** Consult your healthcare provider for proper diagnosis and treatment.`;
  }

  if (lowerQuery.includes('thyroid') || lowerQuery.includes('tsh') || lowerQuery.includes('t3') || lowerQuery.includes('t4')) {
    return `**Thyroid Function Information:**

The thyroid gland regulates metabolism, energy, and body temperature.

**Normal Ranges:**
• TSH: 0.4-4.0 mIU/L
• T3: 80-200 ng/dL
• T4: 5-12 mcg/dL

**High TSH (Hypothyroidism):**
• Symptoms: fatigue, weight gain, cold sensitivity, dry skin
• May need thyroid hormone medication

**Low TSH (Hyperthyroidism):**
• Symptoms: weight loss, rapid heartbeat, anxiety, heat sensitivity
• Requires medical treatment

**Lifestyle Tips:**
• Eat iodine-rich foods: iodized salt, seafood
• Manage stress
• Get adequate sleep
• Exercise regularly

**Important:** Thyroid disorders require medical management. Consult your doctor for proper treatment.`;
  }

  if (lowerQuery.includes('sugar') || lowerQuery.includes('glucose') || lowerQuery.includes('diabetes') || lowerQuery.includes('hba1c')) {
    return `**Blood Sugar & Diabetes Information:**

**Normal Ranges:**
• Fasting glucose: 70-100 mg/dL
• Post-meal (2 hours): <140 mg/dL
• HbA1c: <5.7% (normal), 5.7-6.4% (prediabetes), ≥6.5% (diabetes)

**To Manage Blood Sugar:**
• Eat balanced meals with fiber, protein, and healthy fats
• Limit refined carbs and sugary foods
• Exercise regularly (30 min daily)
• Maintain healthy weight
• Stay hydrated

**Good Foods:**
• Whole grains, dal, beans
• Vegetables (especially leafy greens)
• Nuts and seeds
• Lean proteins

**Foods to Limit:**
• White rice, white bread
• Sugary drinks and sweets
• Fried foods
• Processed snacks

**Important:** If you have diabetes or prediabetes, work closely with your doctor for proper management.`;
  }

  if (lowerQuery.includes('cholesterol') || lowerQuery.includes('lipid') || lowerQuery.includes('hdl') || lowerQuery.includes('ldl')) {
    return `**Cholesterol & Lipid Profile Information:**

**Normal Ranges:**
• Total Cholesterol: <200 mg/dL
• LDL (bad): <100 mg/dL
• HDL (good): >40 mg/dL (men), >50 mg/dL (women)
• Triglycerides: <150 mg/dL

**To Improve Cholesterol:**
• Eat more fiber: oats, beans, fruits, vegetables
• Choose healthy fats: nuts, olive oil, fish
• Limit saturated fats: red meat, butter, cheese
• Avoid trans fats: fried foods, packaged snacks
• Exercise regularly
• Maintain healthy weight

**Heart-Healthy Foods:**
• Oats, barley, whole grains
• Fatty fish (salmon, mackerel)
• Nuts (almonds, walnuts)
• Fruits and vegetables
• Olive oil

**Important:** High cholesterol increases heart disease risk. Consult your doctor for personalized treatment.`;
  }

  if (lowerQuery.includes('diet') || lowerQuery.includes('food') || lowerQuery.includes('meal') || lowerQuery.includes('eat')) {
    return `**Healthy Diet Guidelines:**

**Balanced Meal Components:**
• 50% vegetables and fruits
• 25% whole grains (brown rice, whole wheat, oats)
• 25% proteins (dal, eggs, chicken, fish, paneer)
• Healthy fats (nuts, seeds, olive oil)

**Daily Recommendations:**
• 8-10 glasses of water
• 5 servings of fruits/vegetables
• 2-3 servings of protein
• 3-4 servings of whole grains
• Limit salt, sugar, and processed foods

**Meal Timing:**
• Breakfast: Within 1 hour of waking
• Lunch: Largest meal of the day
• Dinner: Light, 2-3 hours before bed
• Healthy snacks between meals

**Indian Diet Tips:**
• Include dal/legumes daily
• Eat seasonal fruits
• Use minimal oil in cooking
• Choose whole wheat over refined flour
• Include yogurt for probiotics

**Important:** For personalized diet plans based on your health data, check your Diet Plan page or consult a nutritionist.`;
  }

  if (lowerQuery.includes('exercise') || lowerQuery.includes('workout') || lowerQuery.includes('fitness')) {
    return `**Exercise & Fitness Guidelines:**

**Recommended Activity:**
• 150 minutes moderate exercise per week
• Or 75 minutes vigorous exercise per week
• Strength training 2 days per week

**Types of Exercise:**
• Cardio: walking, jogging, cycling, swimming
• Strength: weights, resistance bands, bodyweight exercises
• Flexibility: yoga, stretching
• Balance: tai chi, yoga

**Getting Started:**
• Start slow and gradually increase
• Choose activities you enjoy
• Set realistic goals
• Stay consistent
• Listen to your body

**Benefits:**
• Improves heart health
• Helps manage weight
• Boosts mood and energy
• Strengthens bones and muscles
• Reduces disease risk

**Important:** Consult your doctor before starting a new exercise program, especially if you have health conditions.`;
  }

  if (lowerQuery.includes('weight') || lowerQuery.includes('obesity') || lowerQuery.includes('bmi')) {
    return `**Weight Management Information:**

**BMI Categories:**
• Underweight: <18.5
• Normal: 18.5-24.9
• Overweight: 25-29.9
• Obese: ≥30

**Healthy Weight Loss:**
• Aim for 0.5-1 kg per week
• Create calorie deficit through diet and exercise
• Focus on sustainable lifestyle changes
• Don't skip meals

**Tips for Weight Management:**
• Eat protein with every meal
• Fill half your plate with vegetables
• Drink water before meals
• Get 7-8 hours of sleep
• Manage stress
• Track your progress

**Avoid:**
• Crash diets or extreme restrictions
• Skipping meals
• Processed and fried foods
• Sugary drinks
• Late-night eating

**Important:** Consult a healthcare provider or nutritionist for personalized weight management plans.`;
  }

  if (lowerQuery.includes('sleep') || lowerQuery.includes('insomnia') || lowerQuery.includes('tired')) {
    return `**Sleep & Rest Information:**

**Recommended Sleep:**
• Adults: 7-9 hours per night
• Quality matters as much as quantity

**Tips for Better Sleep:**
• Maintain consistent sleep schedule
• Create dark, quiet, cool environment
• Avoid screens 1 hour before bed
• Limit caffeine after 2 PM
• Exercise regularly (but not before bed)
• Avoid heavy meals late at night

**Sleep Hygiene:**
• Use bed only for sleep
• Establish relaxing bedtime routine
• Try meditation or deep breathing
• Keep bedroom temperature cool
• Use comfortable mattress and pillows

**Signs of Sleep Problems:**
• Difficulty falling asleep
• Frequent waking during night
• Daytime fatigue
• Mood changes
• Difficulty concentrating

**Important:** If sleep problems persist, consult your doctor as they may indicate underlying health issues.`;
  }

  if (lowerQuery.includes('stress') || lowerQuery.includes('anxiety') || lowerQuery.includes('mental')) {
    return `**Stress & Mental Health:**

**Stress Management Techniques:**
• Deep breathing exercises
• Meditation or mindfulness
• Regular physical activity
• Adequate sleep
• Social connections
• Time management
• Hobbies and relaxation

**Warning Signs:**
• Persistent worry or fear
• Changes in sleep or appetite
• Difficulty concentrating
• Physical symptoms (headaches, stomach issues)
• Mood swings
• Social withdrawal

**Self-Care Tips:**
• Practice gratitude
• Set boundaries
• Take breaks
• Connect with loved ones
• Engage in enjoyable activities
• Limit news/social media

**When to Seek Help:**
• Symptoms interfere with daily life
• Persistent sadness or hopelessness
• Thoughts of self-harm
• Substance use to cope

**Important:** Mental health is as important as physical health. Don't hesitate to seek professional help from a counselor or psychiatrist.`;
  }

  if (lowerQuery.includes('report') || lowerQuery.includes('test') || lowerQuery.includes('result')) {
    return `**Understanding Your Health Reports:**

I can help you understand various health test results including:

• **Blood Tests:** CBC, lipid profile, liver function, kidney function
• **Vitamin Levels:** D, B12, iron, calcium
• **Hormones:** Thyroid (TSH, T3, T4), reproductive hormones
• **Metabolic:** Blood sugar, HbA1c, insulin
• **Others:** Uric acid, electrolytes, inflammatory markers

**How to Read Reports:**
• Check if values are within normal range
• Look for "High" or "Low" indicators
• Note the units of measurement
• Compare with previous results if available

**What to Do:**
• Share specific test names or values for detailed explanation
• Upload your report for comprehensive analysis
• Discuss results with your doctor
• Follow up on abnormal values

**Important:** Lab results should always be interpreted by a healthcare professional in the context of your overall health.

What specific test or value would you like me to explain?`;
  }

  if (lowerQuery.includes('symptom') || lowerQuery.includes('pain') || lowerQuery.includes('fever') || lowerQuery.includes('sick')) {
    return `**About Symptoms:**

I can provide general information about common symptoms, but I cannot diagnose conditions.

**Common Symptoms & General Guidance:**

• **Fever:** Rest, stay hydrated, monitor temperature
• **Headache:** Rest, hydration, avoid triggers
• **Fatigue:** Ensure adequate sleep, check for deficiencies
• **Pain:** Note location, intensity, duration
• **Digestive Issues:** Monitor diet, stay hydrated

**When to See a Doctor Immediately:**
• High fever (>103°F/39.4°C)
• Severe pain
• Difficulty breathing
• Chest pain
• Sudden weakness or numbness
• Persistent vomiting
• Signs of dehydration

**For Better Help:**
• Describe your symptoms in detail
• Mention duration and severity
• Note any triggers or patterns
• List any medications you're taking

**Important:** This is general information only. For proper diagnosis and treatment, please consult a healthcare professional.

What specific symptom would you like to know more about?`;
  }

  if (lowerQuery.includes('medicine') || lowerQuery.includes('medication') || lowerQuery.includes('drug')) {
    return `**About Medications:**

**Important Safety Information:**

I can provide general information about medications, but I cannot:
• Prescribe medications
• Recommend specific drugs
• Advise on dosages
• Suggest stopping medications

**Medication Safety Tips:**
• Take as prescribed by your doctor
• Don't skip doses
• Complete full course (especially antibiotics)
• Note any side effects
• Check for drug interactions
• Store properly
• Check expiration dates

**When Taking Medications:**
• Follow timing instructions
• Take with or without food as directed
• Avoid alcohol if contraindicated
• Don't share medications
• Keep a list of all medications

**Questions for Your Doctor:**
• What is this medication for?
• How and when should I take it?
• What are possible side effects?
• Are there any interactions?
• How long should I take it?

**Important:** Always consult your doctor or pharmacist for medication-related questions. Never start, stop, or change medications without medical advice.`;
  }

  if (lowerQuery.includes('doctor') || lowerQuery.includes('appointment') || lowerQuery.includes('consult')) {
    return `**About Doctor Consultations:**

**When to See a Doctor:**
• Persistent or worsening symptoms
• Abnormal test results
• New or concerning symptoms
• Chronic condition management
• Preventive care and checkups
• Medication management

**Preparing for Your Appointment:**
• List your symptoms and concerns
• Bring previous medical records
• List current medications
• Prepare questions to ask
• Note any allergies

**Our Platform Features:**
• Browse available doctors
• Check specializations
• Book appointments
• Video consultations
• Access your health records

**Types of Specialists:**
• General Physician: Overall health
• Cardiologist: Heart health
• Endocrinologist: Hormones, diabetes
• Gastroenterologist: Digestive system
• Dermatologist: Skin conditions
• And many more...

**Important:** Regular checkups and preventive care are key to maintaining good health.

Would you like help finding a doctor or booking an appointment?`;
  }

  // Default response for general queries
  return `**I'm Your AI Health Assistant**

I can help you with:

✓ **Understanding Health Reports** - Explain lab values and test results
✓ **Vitamin & Nutrient Information** - Deficiencies, sources, recommendations
✓ **Diet & Nutrition** - Healthy eating guidelines and meal planning
✓ **Common Health Conditions** - Information about symptoms and management
✓ **Lifestyle Guidance** - Exercise, sleep, stress management
✓ **General Health Questions** - Wellness tips and preventive care

**How to Get Better Answers:**
• Be specific about your question
• Mention specific test names or values
• Describe symptoms in detail
• Share relevant health information

**Important Reminder:**
I provide general health information and education. For medical diagnosis, treatment, or emergencies, always consult with a qualified healthcare professional.

**What would you like to know?** You can ask about:
• Specific lab values or vitamins
• Diet and nutrition advice
• Understanding symptoms
• Health conditions
• Lifestyle recommendations

Feel free to ask your question!`;
}
