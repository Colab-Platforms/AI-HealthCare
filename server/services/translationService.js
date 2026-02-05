const axios = require('axios');

// Simple Hindi translation mapping for common health terms
const hindiTranslations = {
  // Health metrics
  'Hemoglobin': 'हीमोग्लोबिन',
  'Blood Pressure': 'रक्तचाप',
  'Vitamin D': 'विटामिन डी',
  'Vitamin B12': 'विटामिन बी12',
  'Iron': 'आयरन',
  'Glucose': 'ग्लूकोज',
  'Cholesterol': 'कोलेस्ट्रॉल',
  'LDL': 'एलडीएल',
  'HDL': 'एचडीएल',
  'Triglycerides': 'ट्राइग्लिसराइड्स',
  'TSH': 'टीएसएच',
  
  // Status
  'normal': 'सामान्य',
  'low': 'कम',
  'high': 'अधिक',
  'elevated': 'बढ़ा हुआ',
  'deficient': 'कमी',
  'insufficient': 'अपर्याप्त',
  'sufficient': 'पर्याप्त',
  'optimal': 'इष्टतम',
  'borderline': 'सीमांत',
  'excellent': 'उत्कृष्ट',
  'good': 'अच्छा',
  
  // Deficiencies
  'Low Hemoglobin (Anemia)': 'कम हीमोग्लोबिन (एनीमिया)',
  'Vitamin D Deficiency': 'विटामिन डी की कमी',
  'Vitamin B12 Deficiency': 'विटामिन बी12 की कमी',
  'Iron Deficiency': 'आयरन की कमी',
  'High Blood Sugar (Hyperglycemia)': 'उच्च रक्त शर्करा (हाइपरग्लाइसेमिया)',
  
  // Symptoms
  'Fatigue': 'थकान',
  'Weakness': 'कमजोरी',
  'Shortness of breath': 'सांस की कमी',
  'Dizziness': 'चक्कर आना',
  'Bone pain': 'हड्डियों में दर्द',
  'Muscle weakness': 'मांसपेशियों की कमजोरी',
  'Frequent infections': 'बार-बार संक्रमण',
  'Numbness in hands/feet': 'हाथों/पैरों में सुन्नता',
  'Memory problems': 'स्मृति समस्याएं',
  'Pale skin': 'पीली त्वचा',
  'Increased thirst': 'प्यास में वृद्धि',
  'Frequent urination': 'बार-बार पेशाब आना',
  'Blurred vision': 'धुंधली दृष्टि',
  
  // Recommendations
  'Eat iron-rich foods': 'आयरन युक्त खाद्य पदार्थ खाएं',
  'red meat': 'लाल मांस',
  'spinach': 'पालक',
  'lentils': 'दाल',
  'beans': 'बीन्स',
  'Get morning sunlight': 'सुबह की धूप लें',
  'fatty fish': 'वसायुक्त मछली',
  'egg yolks': 'अंडे की जर्दी',
  'fortified milk': 'फोर्टिफाइड दूध',
  'Consult doctor': 'डॉक्टर से परामर्श लें',
  'Exercise regularly': 'नियमित व्यायाम करें',
  'Balanced diet': 'संतुलित आहार',
  'Adequate sleep': 'पर्याप्त नींद',
  'Stress management': 'तनाव प्रबंधन',
  
  // General
  'Great news': 'बहुत अच्छी खबर है',
  'Your health report shows': 'आपकी स्वास्थ्य रिपोर्ट दिखाती है',
  'normal ranges': 'सामान्य सीमा में',
  'needs attention': 'ध्यान देने की आवश्यकता है',
  'manageable with': 'के साथ प्रबंधनीय है',
  'diet changes': 'आहार परिवर्तन',
  'lifestyle modifications': 'जीवनशैली में संशोधन',
  'healthcare professional': 'स्वास्थ्य सेवा पेशेवर',
  'personalized guidance': 'व्यक्तिगत मार्गदर्शन',
  'common health concerns': 'सामान्य स्वास्थ्य समस्याएं',
  'comprehensive treatment plan': 'व्यापक उपचार योजना',
};

// Translate text to Hindi using simple mapping
const translateToHindi = (text) => {
  if (!text) return '';
  
  let translatedText = text;
  
  // Replace known terms
  Object.entries(hindiTranslations).forEach(([english, hindi]) => {
    const regex = new RegExp(`\\b${english}\\b`, 'gi');
    translatedText = translatedText.replace(regex, hindi);
  });
  
  return translatedText;
};

// Translate analysis object to Hindi
const translateAnalysisToHindi = (analysis) => {
  if (!analysis) return null;
  
  const hindiAnalysis = { ...analysis };
  
  // Translate summary
  if (analysis.summary) {
    hindiAnalysis.summaryHindi = translateToHindi(analysis.summary);
  }
  
  // Translate key findings
  if (analysis.keyFindings && Array.isArray(analysis.keyFindings)) {
    hindiAnalysis.keyFindingsHindi = analysis.keyFindings.map(finding => 
      translateToHindi(finding)
    );
  }
  
  // Translate risk factors
  if (analysis.riskFactors && Array.isArray(analysis.riskFactors)) {
    hindiAnalysis.riskFactorsHindi = analysis.riskFactors.map(factor => 
      translateToHindi(factor)
    );
  }
  
  // Translate deficiencies
  if (analysis.deficiencies && Array.isArray(analysis.deficiencies)) {
    hindiAnalysis.deficienciesHindi = analysis.deficiencies.map(def => ({
      ...def,
      nameHindi: translateToHindi(def.name),
      symptomsHindi: def.symptoms ? def.symptoms.map(s => translateToHindi(s)) : [],
      causesHindi: def.causes ? def.causes.map(c => translateToHindi(c)) : [],
      recommendationsHindi: def.recommendations ? def.recommendations.map(r => translateToHindi(r)) : []
    }));
  }
  
  // Translate recommendations
  if (analysis.recommendations) {
    hindiAnalysis.recommendationsHindi = {};
    if (analysis.recommendations.lifestyle) {
      hindiAnalysis.recommendationsHindi.lifestyle = analysis.recommendations.lifestyle.map(r => 
        translateToHindi(r)
      );
    }
    if (analysis.recommendations.diet) {
      hindiAnalysis.recommendationsHindi.diet = translateToHindi(analysis.recommendations.diet);
    }
    if (analysis.recommendations.tests) {
      hindiAnalysis.recommendationsHindi.tests = analysis.recommendations.tests.map(t => 
        translateToHindi(t)
      );
    }
  }
  
  // Translate overall trend
  if (analysis.overallTrend) {
    hindiAnalysis.overallTrendHindi = translateToHindi(analysis.overallTrend);
  }
  
  return hindiAnalysis;
};

// Translate using OpenRouter API for more accurate translation
const translateWithAI = async (text, targetLanguage = 'hi') => {
  try {
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('[TRANSLATION] API key not available, using local translation');
      return targetLanguage === 'hi' ? translateToHindi(text) : text;
    }

    const response = await axios.post(
      'https://openrouter.ai/api/v1/chat/completions',
      {
        model: 'google/gemini-2.0-flash-exp:free',
        messages: [
          {
            role: 'system',
            content: `You are a medical translator. Translate the following medical text to ${targetLanguage === 'hi' ? 'Hindi' : 'English'} in simple, easy-to-understand language. Keep medical terms accurate. Return ONLY the translated text, nothing else.`
          },
          {
            role: 'user',
            content: text
          }
        ],
        temperature: 0.3,
        max_tokens: 1000
      },
      {
        headers: {
          'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json',
          'HTTP-Referer': 'http://localhost:5000',
          'X-Title': 'HealthAI'
        },
        timeout: 15000
      }
    );

    return response.data.choices[0].message.content;
  } catch (error) {
    console.error('[TRANSLATION] AI translation failed:', error.message);
    // Fallback to local translation
    return targetLanguage === 'hi' ? translateToHindi(text) : text;
  }
};

module.exports = {
  translateToHindi,
  translateAnalysisToHindi,
  translateWithAI,
  hindiTranslations
};
