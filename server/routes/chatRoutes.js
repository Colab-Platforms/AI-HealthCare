const express = require('express');
const router = express.Router();
const axios = require('axios');
const { protect } = require('../middleware/auth');
const HealthMetric = require('../models/HealthMetric');
const FoodLog = require('../models/FoodLog');

// AI Chat endpoint - Requires authentication for personalized context
router.post('/chat', protect, async (req, res) => {
  try {
    const { query, conversationHistory, userReports } = req.body;
    const user = req.user;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Query is required'
      });
    }

    console.log(`AI Chat request from ${user.name} for query: ${query.substring(0, 50)}`);

    // Prepare system prompt with comprehensive user context
    const profile = user.profile || {};
    const lifestyle = profile.lifestyle || {};
    const medical = profile.medicalHistory || {};
    const goals = user.nutritionGoal || {};

    let systemPrompt = `You are a knowledgeable and empathetic healthcare AI assistant named take.health Coach.
     
User Context:
- Name: ${user.name}
- Profile: Age ${profile.age || 'N/A'}, Gender ${profile.gender || 'N/A'}, BMI ${user.healthMetrics?.bmi || 'N/A'}
- Medical History: ${medical.conditions?.length > 0 ? medical.conditions.join(', ') : 'None reported'}
- Chronic Conditions: ${profile.chronicConditions?.length > 0 ? profile.chronicConditions.join(', ') : 'None reported'}
- Diabetic: ${(profile.isDiabetic === 'yes' || (medical.conditions && medical.conditions.some(c => c.toLowerCase().includes('diabet')))) ? 'Yes' : 'No'}
- Current Medications: ${medical.currentMedications?.length > 0 ? medical.currentMedications.join(', ') : 'None reported'}
- Lifestyle: Smoker: ${lifestyle.smoker ? 'Yes' : 'No'}, Stress: ${lifestyle.stressLevel || 'N/A'}, Sleep: ${lifestyle.sleepHours || 'N/A'} hours
- Fitness Goals: ${goals.goal || 'General health improvement'} (Target: ${goals.targetWeight || 'N/A'} kg)

Your role is to:
1. Provide accurate, evidence-based health and nutrition information.
2. Answer questions about their diet, exercise, and medical reports.
3. Offer highly personalized recommendations based on the User Context provided above.
4. If they ask about their own health, refer to their specific conditions or goals mentioned in the context.
5. Always remind users that you are an AI assistant and they should consult healthcare professionals for medical decisions.
6. Be supportive, concise, and professional.

IMPORTANT FORMATTING RULES - Follow these strictly:
- Do NOT use markdown formatting like ** for bold, ## for headers, or __ for underline.
- Use plain text only.
- Use bullet points with the bullet character or numbered lists for organized information.
- Keep responses clean, readable, and well-structured with clear line breaks.
- Do not use excessive exclamation marks, random special characters, or technical jargon.
- Write in a warm, conversational yet professional tone.
- Structure long answers with clear sections using simple labels followed by a colon.
- Never refer to yourself as FitCure. Your name is take.health Coach.`;

    // Add report context if available
    if (userReports && userReports.length > 0) {
      const reportContext = userReports.map(report => {
        const date = new Date(report.date).toLocaleDateString();
        const metrics = report.metrics ? JSON.stringify(report.metrics) : '';
        return `Report: ${report.type || 'Health Report'} (${date})\nAnalysis: ${report.analysis || 'No analysis'}\nMetrics: ${metrics}`;
      }).join('\n\n');

      systemPrompt += `\n\nRecent Health Reports:\n${reportContext}`;
    }

    let processedQuery = query;

    const isDiabetic = profile.isDiabetic === 'yes' || 
                       (medical.conditions && medical.conditions.some(c => c.toLowerCase().includes('diabet')));

    let recentVitalsContext = '';
    let recentDietContext = '';

    if (isDiabetic) {
      try {
        const recentMetrics = await HealthMetric.find({
            userId: user._id, 
            type: { $in: ['blood_sugar', 'hba1c'] }
        }).sort({ recordedAt: -1 }).limit(5);

        if (recentMetrics && recentMetrics.length > 0) {
          recentVitalsContext = `\n[Recent Logged Glucose/HbA1c]\n` + recentMetrics.map(m => `- ${m.type === 'blood_sugar' ? 'Blood Sugar' : 'HbA1c'}: ${m.value} ${m.unit} (${m.readingContext || 'N/A'}) on ${m.recordedAt ? new Date(m.recordedAt).toLocaleDateString() : 'recent'}`).join('\n');
        }

        const startOfDay = new Date();
        startOfDay.setHours(0, 0, 0, 0);
        const todaysLogs = await FoodLog.find({
            userId: user._id,
            timestamp: { $gte: startOfDay }
        });

        if (todaysLogs && todaysLogs.length > 0) {
           let totalCal = 0;
           let totalCarb = 0;
           const items = [];
           todaysLogs.forEach(log => {
               totalCal += log.totalNutrition?.calories || 0;
               totalCarb += log.totalNutrition?.carbs || 0;
               if (log.foodItems) {
                   log.foodItems.forEach(fi => items.push(`${fi.quantity} ${fi.name}`));
               }
           });
           recentDietContext = `\n[Today's Diet Summary]\n- Total Calories: ${Math.round(totalCal)} kcal\n- Total Carbs: ${Math.round(totalCarb)} g\n- Foods Consumed: ${items.join(', ')}`;
        }
      } catch (err) {
        console.error("Error fetching context for AI Coach:", err);
      }
    }

    if (isDiabetic) {
      systemPrompt += `\n\nSPECIAL ABILITY: SMART GLYCEMIC RESPONSE PREDICTOR + MEAL COACH
Since the user is diabetic, you must act as a "Personal Diabetic Coach in their pocket" anytime food or eating is mentioned.
You have access to their real-time activity and vitals context below to make your predictions incredibly accurate:
${recentVitalsContext}
${recentDietContext}

If the user inputs or describes a meal (e.g. "2 roti + dal", "I am about to eat a banana"), you MUST predict their glycemic response BEFORE they eat it. Consider what they have already eaten today and their recent glucose logs when forming your prediction.
Structure your response exactly like this template:

⚠️ This may spike your sugar to ~[Estimated mg/dL based on typical glycemic index/load, their history, and today's total carbs]
⏰ Time to peak: [Estimated time, e.g. 1-2 hours]
👉 [Suggest better alternatives or safe portion size, e.g., "Reduce rice by 50% OR add a large bowl of cucumber salad"]
✅ [A specific post-meal lifestyle tip, e.g., "Add 10 min walk 30 mins after eating"]

Make the meal feedback immediate, clear, highly actionable, and always use these emojis to act as a daily decision-making assistant. Use realistic estimations based on standard clinical knowledge for diabetes.`;
    }

    // Build messages array
    const messages = [];

    if (conversationHistory && Array.isArray(conversationHistory)) {
      conversationHistory.slice(-6).forEach(msg => {
        if (msg.role && msg.content && !msg.content.includes('Hello')) {
          messages.push({
            role: msg.role === 'user' ? 'user' : 'assistant',
            content: msg.content
          });
        }
      });
    }

    messages.push({ role: 'user', content: processedQuery });

    let aiResponse = null;

    // Try Anthropic Direct API first
    const anthropicKey = process.env.ANTHROPIC_API_KEY;
    if (!aiResponse && anthropicKey && anthropicKey.startsWith('sk-ant')) {
      try {
        const response = await axios.post(
          'https://api.anthropic.com/v1/messages',
          {
            model: 'claude-sonnet-4-6',
            system: systemPrompt,
            messages: messages,
            temperature: 0.7,
            max_tokens: 1500
          },
          {
            headers: {
              'x-api-key': anthropicKey,
              'anthropic-version': '2023-06-01',
              'Content-Type': 'application/json'
            },
            timeout: 30000
          }
        );

        if (response.data && response.data.content && response.data.content[0]) {
          aiResponse = response.data.content[0].text;
        }
      } catch (error) {
        console.error('Anthropic Direct failed:', error.message);
      }
    }

    // If API failed, use intelligent fallback
    if (!aiResponse) {
      aiResponse = generateIntelligentResponse(query, user.name);
    }

    res.json({
      success: true,
      response: aiResponse,
      timestamp: new Date().toISOString(),
      mode: aiResponse.includes('⚠️') ? 'fallback' : 'ai'
    });

  } catch (error) {
    console.error('AI Chat error:', error.message);
    const userName = req.user?.name || 'there';
    const fallbackResponse = generateIntelligentResponse(req.body.query, userName);

    res.json({
      success: true,
      response: fallbackResponse,
      timestamp: new Date().toISOString(),
      mode: 'fallback'
    });
  }
});

// Intelligent fallback response generator
function generateIntelligentResponse(query, userName = 'there') {
  const lowerQuery = query.toLowerCase();

  // Greeting
  if (lowerQuery.includes('hello') || lowerQuery.includes('hi ') || lowerQuery === 'hi') {
    return `Hello ${userName}! I'm your take.health Coach. How can I help you with your health or nutrition goals today?`;
  }

  // Health metrics and lab values
  if (lowerQuery.includes('vitamin d') || lowerQuery.includes('vitamin-d')) {
    return `Vitamin D Information

Vitamin D is essential for bone health, immune function, and overall wellbeing.

Normal Range: 30-100 ng/mL
• Deficient: Less than 20 ng/mL
• Insufficient: 20-30 ng/mL
• Optimal: 30-100 ng/mL

If Your Levels Are Low:
• Get 15-20 minutes of morning sunlight daily
• Eat fatty fish (salmon, mackerel), egg yolks, fortified milk
• Consider supplements (consult your doctor for dosage)

Symptoms of Deficiency:
• Fatigue and tiredness
• Bone pain or muscle weakness
• Frequent infections
• Mood changes or depression

Important: Always consult with your healthcare provider for personalized advice and treatment.`;
  }

  if (lowerQuery.includes('iron') || lowerQuery.includes('hemoglobin') || lowerQuery.includes('anemia')) {
    return `Iron and Hemoglobin Information

Iron is crucial for producing hemoglobin, which carries oxygen in your blood.

Normal Ranges:
• Hemoglobin: 12-17 g/dL (varies by age/gender)
• Iron: 60-170 mcg/dL
• Ferritin: 12-300 ng/mL

To Increase Iron Levels:
• Eat iron-rich foods: red meat, chicken, fish, spinach, dal, beans
• Pair with Vitamin C: citrus fruits, tomatoes, bell peppers
• Avoid tea/coffee with meals (reduces absorption)
• Cook in iron utensils

Symptoms of Low Iron:
• Extreme fatigue
• Pale skin
• Shortness of breath
• Cold hands and feet
• Dizziness or headaches

Important: Consult your doctor before taking iron supplements as too much iron can be harmful.`;
  }

  if (lowerQuery.includes('vitamin b12') || lowerQuery.includes('b12')) {
    return `Vitamin B12 Information

B12 is essential for nerve function, red blood cell formation, and DNA synthesis.

Normal Range: 200-900 pg/mL
• Deficient: Less than 200 pg/mL
• Borderline: 200-300 pg/mL

Food Sources:
• Eggs, milk, yogurt, cheese
• Fish (salmon, tuna)
• Chicken and meat
• Fortified cereals

Symptoms of Deficiency:
• Fatigue and weakness
• Tingling in hands/feet
• Memory problems
• Mood changes

Note: Vegetarians and vegans are at higher risk and may need supplements.

Important: Consult your healthcare provider for proper diagnosis and treatment.`;
  }

  if (lowerQuery.includes('thyroid') || lowerQuery.includes('tsh') || lowerQuery.includes('t3') || lowerQuery.includes('t4')) {
    return `Thyroid Function Information

The thyroid gland regulates metabolism, energy, and body temperature.

Normal Ranges:
• TSH: 0.4-4.0 mIU/L
• T3: 80-200 ng/dL
• T4: 5-12 mcg/dL

High TSH (Hypothyroidism):
• Symptoms: fatigue, weight gain, cold sensitivity, dry skin
• May need thyroid hormone medication

Low TSH (Hyperthyroidism):
• Symptoms: weight loss, rapid heartbeat, anxiety, heat sensitivity
• Requires medical treatment

Lifestyle Tips:
• Eat iodine-rich foods: iodized salt, seafood
• Manage stress
• Get adequate sleep
• Exercise regularly

Important: Thyroid disorders require medical management. Consult your doctor for proper treatment.`;
  }

  if (lowerQuery.includes('sugar') || lowerQuery.includes('glucose') || lowerQuery.includes('diabetes') || lowerQuery.includes('hba1c')) {
    return `Blood Sugar and Diabetes Information

Normal Ranges:
• Fasting glucose: 70-100 mg/dL
• Post-meal (2 hours): Less than 140 mg/dL
• HbA1c: Less than 5.7% (normal), 5.7-6.4% (prediabetes), 6.5% or above (diabetes)

To Manage Blood Sugar:
• Eat balanced meals with fiber, protein, and healthy fats
• Limit refined carbs and sugary foods
• Exercise regularly (30 min daily)
• Maintain healthy weight
• Stay hydrated

Good Foods:
• Whole grains, dal, beans
• Vegetables (especially leafy greens)
• Nuts and seeds
• Lean proteins

Foods to Limit:
• White rice, white bread
• Sugary drinks and sweets
• Fried foods
• Processed snacks

Important: If you have diabetes or prediabetes, work closely with your doctor for proper management.`;
  }

  if (lowerQuery.includes('cholesterol') || lowerQuery.includes('lipid') || lowerQuery.includes('hdl') || lowerQuery.includes('ldl')) {
    return `Cholesterol and Lipid Profile Information

Normal Ranges:
• Total Cholesterol: Less than 200 mg/dL
• LDL (bad cholesterol): Less than 100 mg/dL
• HDL (good cholesterol): More than 40 mg/dL (men), More than 50 mg/dL (women)
• Triglycerides: Less than 150 mg/dL

To Improve Cholesterol:
• Eat more fiber: oats, beans, fruits, vegetables
• Choose healthy fats: nuts, olive oil, fish
• Limit saturated fats: red meat, butter, cheese
• Avoid trans fats: fried foods, packaged snacks
• Exercise regularly
• Maintain healthy weight

Heart-Healthy Foods:
• Oats, barley, whole grains
• Fatty fish (salmon, mackerel)
• Nuts (almonds, walnuts)
• Fruits and vegetables
• Olive oil

Important: High cholesterol increases heart disease risk. Consult your doctor for personalized treatment.`;
  }

  if (lowerQuery.includes('diet') || lowerQuery.includes('food') || lowerQuery.includes('meal') || lowerQuery.includes('eat')) {
    return `Healthy Diet Guidelines

Balanced Meal Components:
• 50% vegetables and fruits
• 25% whole grains (brown rice, whole wheat, oats)
• 25% proteins (dal, eggs, chicken, fish, paneer)
• Healthy fats (nuts, seeds, olive oil)

Daily Recommendations:
• 8-10 glasses of water
• 5 servings of fruits/vegetables
• 2-3 servings of protein
• 3-4 servings of whole grains
• Limit salt, sugar, and processed foods

Meal Timing:
• Breakfast: Within 1 hour of waking
• Lunch: Largest meal of the day
• Dinner: Light, 2-3 hours before bed
• Healthy snacks between meals

Indian Diet Tips:
• Include dal/legumes daily
• Eat seasonal fruits
• Use minimal oil in cooking
• Choose whole wheat over refined flour
• Include yogurt for probiotics

Important: For personalized diet plans based on your health data, check your Diet Plan page or consult a nutritionist.`;
  }

  if (lowerQuery.includes('exercise') || lowerQuery.includes('workout') || lowerQuery.includes('fitness')) {
    return `Exercise and Fitness Guidelines

Recommended Activity:
• 150 minutes moderate exercise per week
• Or 75 minutes vigorous exercise per week
• Strength training 2 days per week

Types of Exercise:
• Cardio: walking, jogging, cycling, swimming
• Strength: weights, resistance bands, bodyweight exercises
• Flexibility: yoga, stretching
• Balance: tai chi, yoga

Getting Started:
• Start slow and gradually increase
• Choose activities you enjoy
• Set realistic goals
• Stay consistent
• Listen to your body

Benefits:
• Improves heart health
• Helps manage weight
• Boosts mood and energy
• Strengthens bones and muscles
• Reduces disease risk

Important: Consult your doctor before starting a new exercise program, especially if you have health conditions.`;
  }

  if (lowerQuery.includes('weight') || lowerQuery.includes('obesity') || lowerQuery.includes('bmi')) {
    return `Weight Management Information

BMI Categories:
• Underweight: Less than 18.5
• Normal: 18.5-24.9
• Overweight: 25-29.9
• Obese: 30 or above

Healthy Weight Loss:
• Aim for 0.5-1 kg per week
• Create calorie deficit through diet and exercise
• Focus on sustainable lifestyle changes
• Do not skip meals

Tips for Weight Management:
• Eat protein with every meal
• Fill half your plate with vegetables
• Drink water before meals
• Get 7-8 hours of sleep
• Manage stress
• Track your progress

Avoid:
• Crash diets or extreme restrictions
• Skipping meals
• Processed and fried foods
• Sugary drinks
• Late-night eating

Important: Consult a healthcare provider or nutritionist for personalized weight management plans.`;
  }

  if (lowerQuery.includes('sleep') || lowerQuery.includes('insomnia') || lowerQuery.includes('tired')) {
    return `Sleep and Rest Information

Recommended Sleep:
• Adults: 7-9 hours per night
• Quality matters as much as quantity

Tips for Better Sleep:
• Maintain consistent sleep schedule
• Create dark, quiet, cool environment
• Avoid screens 1 hour before bed
• Limit caffeine after 2 PM
• Exercise regularly (but not before bed)
• Avoid heavy meals late at night

Sleep Hygiene:
• Use bed only for sleep
• Establish relaxing bedtime routine
• Try meditation or deep breathing
• Keep bedroom temperature cool
• Use comfortable mattress and pillows

Signs of Sleep Problems:
• Difficulty falling asleep
• Frequent waking during night
• Daytime fatigue
• Mood changes
• Difficulty concentrating

Important: If sleep problems persist, consult your doctor as they may indicate underlying health issues.`;
  }

  if (lowerQuery.includes('stress') || lowerQuery.includes('anxiety') || lowerQuery.includes('mental')) {
    return `Stress and Mental Health

Stress Management Techniques:
• Deep breathing exercises
• Meditation or mindfulness
• Regular physical activity
• Adequate sleep
• Social connections
• Time management
• Hobbies and relaxation

Warning Signs:
• Persistent worry or fear
• Changes in sleep or appetite
• Difficulty concentrating
• Physical symptoms (headaches, stomach issues)
• Mood swings
• Social withdrawal

Self-Care Tips:
• Practice gratitude
• Set boundaries
• Take breaks
• Connect with loved ones
• Engage in enjoyable activities
• Limit news/social media

When to Seek Help:
• Symptoms interfere with daily life
• Persistent sadness or hopelessness
• Thoughts of self-harm
• Substance use to cope

Important: Mental health is as important as physical health. Do not hesitate to seek professional help from a counselor or psychiatrist.`;
  }

  if (lowerQuery.includes('report') || lowerQuery.includes('test') || lowerQuery.includes('result')) {
    return `Understanding Your Health Reports

I can help you understand various health test results including:

• Blood Tests: CBC, lipid profile, liver function, kidney function
• Vitamin Levels: D, B12, iron, calcium
• Hormones: Thyroid (TSH, T3, T4), reproductive hormones
• Metabolic: Blood sugar, HbA1c, insulin
• Others: Uric acid, electrolytes, inflammatory markers

How to Read Reports:
• Check if values are within normal range
• Look for High or Low indicators
• Note the units of measurement
• Compare with previous results if available

What to Do:
• Share specific test names or values for detailed explanation
• Upload your report for comprehensive analysis
• Discuss results with your doctor
• Follow up on abnormal values

Important: Lab results should always be interpreted by a healthcare professional in the context of your overall health.

What specific test or value would you like me to explain?`;
  }

  if (lowerQuery.includes('symptom') || lowerQuery.includes('pain') || lowerQuery.includes('fever') || lowerQuery.includes('sick')) {
    return `About Symptoms

I can provide general information about common symptoms, but I cannot diagnose conditions.

Common Symptoms and General Guidance:

• Fever: Rest, stay hydrated, monitor temperature
• Headache: Rest, hydration, avoid triggers
• Fatigue: Ensure adequate sleep, check for deficiencies
• Pain: Note location, intensity, duration
• Digestive Issues: Monitor diet, stay hydrated

When to See a Doctor Immediately:
• High fever (above 103 F / 39.4 C)
• Severe pain
• Difficulty breathing
• Chest pain
• Sudden weakness or numbness
• Persistent vomiting
• Signs of dehydration

For Better Help:
• Describe your symptoms in detail
• Mention duration and severity
• Note any triggers or patterns
• List any medications you are taking

Important: This is general information only. For proper diagnosis and treatment, please consult a healthcare professional.

What specific symptom would you like more information about?`;
  }

  if (lowerQuery.includes('medication') || lowerQuery.includes('medicine') || lowerQuery.includes('drug')) {
    return `About Medications

Important Safety Information:

I can provide general information about medications, but I cannot:
• Prescribe medications
• Recommend specific drugs
• Advise on dosages
• Suggest stopping medications

Medication Safety Tips:
• Take as prescribed by your doctor
• Do not skip doses
• Complete full course (especially antibiotics)
• Note any side effects
• Check for drug interactions
• Store properly
• Check expiration dates

Important: Always consult your doctor or pharmacist for medication-related questions. Never start, stop, or change medications without medical advice.`;
  }

  // Default response for general queries
  return `I am Your take.health Coach

I can help you with:

• Understanding Reports - Explain lab values and test results
• Nutrition - Healthy eating and nutritional sources
• Lifestyle - Exercise, sleep, stress management
• General Health - Information about symptoms and conditions

How to Get Better Answers:
• Be specific about your question
• Share relevant health information or report values
• Describe symptoms clearly

Important Reminder:
I provide general health information and education. For medical diagnosis, treatment, or emergencies, always consult with a qualified healthcare professional.

Hello ${userName}, how can I specifically assist you today?`;
}

module.exports = router;
