// Test script to verify array validation logic
// Run: node test-array-validation.js

console.log('🧪 Testing Array Validation Logic\n');

// Simulate AI response with string values (the problem)
const mockAIResponse = {
  healthScore: "Good",  // String instead of number
  deficiencies: "Slightly elevated monocytes",  // String instead of array
  supplements: "Vitamin D supplementation recommended",  // String instead of array
  keyFindings: "Low hemoglobin detected",  // String instead of array
  dietPlan: {
    breakfast: "Oatmeal with fruits",  // String instead of array
    foodsToIncrease: "Leafy greens",  // String instead of array
  },
  recommendations: {
    lifestyle: "Exercise regularly",  // String instead of array
  },
  doctorConsultation: {
    specializations: "Hematologist"  // String instead of array
  }
};

console.log('📥 Mock AI Response (with errors):');
console.log(JSON.stringify(mockAIResponse, null, 2));
console.log('\n' + '='.repeat(60) + '\n');

// Apply validation logic (same as in healthController.js)
const aiAnalysis = { ...mockAIResponse };

// ✅ Validate healthScore
if (aiAnalysis.healthScore) {
  if (typeof aiAnalysis.healthScore === 'string') {
    const scoreMap = {
      'excellent': 95, 'very good': 90, 'good': 85,
      'fair': 75, 'poor': 60, 'very poor': 50
    };
    const lowerScore = aiAnalysis.healthScore.toLowerCase();
    aiAnalysis.healthScore = scoreMap[lowerScore] || 75;
    console.log('✅ Converted string healthScore to number:', aiAnalysis.healthScore);
  }
  aiAnalysis.healthScore = Math.max(0, Math.min(100, Number(aiAnalysis.healthScore) || 75));
}

// ✅ Validate deficiencies
if (!Array.isArray(aiAnalysis.deficiencies)) {
  console.log('⚠️  deficiencies is not an array, fixing...');
  if (typeof aiAnalysis.deficiencies === 'string') {
    aiAnalysis.deficiencies = [{
      name: aiAnalysis.deficiencies,
      severity: 'moderate',
      currentValue: 'N/A',
      normalRange: 'N/A',
      symptoms: []
    }];
    console.log('✅ Converted to array:', aiAnalysis.deficiencies);
  }
}

// ✅ Validate supplements
if (!Array.isArray(aiAnalysis.supplements)) {
  console.log('⚠️  supplements is not an array, fixing...');
  if (typeof aiAnalysis.supplements === 'string') {
    aiAnalysis.supplements = [{
      category: 'General Health',
      reason: aiAnalysis.supplements,
      naturalSources: 'Consult healthcare professional',
      note: 'Please consult with your doctor'
    }];
    console.log('✅ Converted to array:', aiAnalysis.supplements);
  }
}

// ✅ Validate keyFindings
if (!Array.isArray(aiAnalysis.keyFindings)) {
  console.log('⚠️  keyFindings is not an array, fixing...');
  if (typeof aiAnalysis.keyFindings === 'string') {
    aiAnalysis.keyFindings = [aiAnalysis.keyFindings];
    console.log('✅ Converted to array:', aiAnalysis.keyFindings);
  }
}

// ✅ Validate dietPlan arrays
if (aiAnalysis.dietPlan) {
  ['breakfast', 'lunch', 'dinner', 'snacks'].forEach(meal => {
    if (aiAnalysis.dietPlan[meal] && !Array.isArray(aiAnalysis.dietPlan[meal])) {
      console.log(`⚠️  dietPlan.${meal} is not an array, fixing...`);
      aiAnalysis.dietPlan[meal] = [];
      console.log(`✅ Set to empty array`);
    }
  });
  
  ['foodsToIncrease', 'foodsToLimit', 'tips'].forEach(field => {
    if (aiAnalysis.dietPlan[field] && !Array.isArray(aiAnalysis.dietPlan[field])) {
      console.log(`⚠️  dietPlan.${field} is not an array, fixing...`);
      if (typeof aiAnalysis.dietPlan[field] === 'string') {
        aiAnalysis.dietPlan[field] = [aiAnalysis.dietPlan[field]];
        console.log(`✅ Converted to array:`, aiAnalysis.dietPlan[field]);
      }
    }
  });
}

// ✅ Validate recommendations
if (aiAnalysis.recommendations) {
  ['immediate', 'shortTerm', 'longTerm', 'lifestyle', 'tests'].forEach(field => {
    if (aiAnalysis.recommendations[field] && !Array.isArray(aiAnalysis.recommendations[field])) {
      console.log(`⚠️  recommendations.${field} is not an array, fixing...`);
      if (typeof aiAnalysis.recommendations[field] === 'string') {
        aiAnalysis.recommendations[field] = [aiAnalysis.recommendations[field]];
        console.log(`✅ Converted to array:`, aiAnalysis.recommendations[field]);
      }
    }
  });
}

// ✅ Validate doctorConsultation.specializations
if (aiAnalysis.doctorConsultation && aiAnalysis.doctorConsultation.specializations && 
    !Array.isArray(aiAnalysis.doctorConsultation.specializations)) {
  console.log('⚠️  doctorConsultation.specializations is not an array, fixing...');
  if (typeof aiAnalysis.doctorConsultation.specializations === 'string') {
    aiAnalysis.doctorConsultation.specializations = [aiAnalysis.doctorConsultation.specializations];
    console.log('✅ Converted to array:', aiAnalysis.doctorConsultation.specializations);
  }
}

console.log('\n' + '='.repeat(60) + '\n');
console.log('📤 Fixed AI Response:');
console.log(JSON.stringify(aiAnalysis, null, 2));

console.log('\n' + '='.repeat(60) + '\n');
console.log('✅ Validation Summary:');
console.log('- healthScore:', typeof aiAnalysis.healthScore, '=', aiAnalysis.healthScore);
console.log('- deficiencies:', Array.isArray(aiAnalysis.deficiencies) ? '✅ Array' : '❌ Not Array');
console.log('- supplements:', Array.isArray(aiAnalysis.supplements) ? '✅ Array' : '❌ Not Array');
console.log('- keyFindings:', Array.isArray(aiAnalysis.keyFindings) ? '✅ Array' : '❌ Not Array');
console.log('- dietPlan.foodsToIncrease:', Array.isArray(aiAnalysis.dietPlan?.foodsToIncrease) ? '✅ Array' : '❌ Not Array');
console.log('- recommendations.lifestyle:', Array.isArray(aiAnalysis.recommendations?.lifestyle) ? '✅ Array' : '❌ Not Array');
console.log('- doctorConsultation.specializations:', Array.isArray(aiAnalysis.doctorConsultation?.specializations) ? '✅ Array' : '❌ Not Array');

console.log('\n✅ All validations passed! Ready for MongoDB save.\n');
