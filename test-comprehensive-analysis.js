const { analyzeHealthReport, generateAnalysisFromText } = require('./server/services/aiService');

// Comprehensive test report with multiple metrics
const testReport = `
COMPREHENSIVE HEALTH REPORT
Date: 2024-02-01
Patient: John Doe, Age: 35, Gender: Male

=== BLOOD TEST PANEL ===

COMPLETE BLOOD COUNT (CBC):
- Hemoglobin: 13.2 g/dL (Normal: 13.5-17.5 for males)
- Hematocrit: 39% (Normal: 41-53%)
- RBC: 4.2 x10^6/µL (Normal: 4.5-5.5)
- WBC: 7.5 x10^3/µL (Normal: 4.5-11.0)
- Platelets: 250 x10^9/L (Normal: 150-400)

METABOLIC PANEL:
- Glucose (Fasting): 115 mg/dL (Normal: 70-100) - ELEVATED
- Creatinine: 0.9 mg/dL (Normal: 0.6-1.2)
- BUN: 18 mg/dL (Normal: 7-20)
- Sodium: 138 mEq/L (Normal: 136-145)
- Potassium: 4.2 mEq/L (Normal: 3.5-5.0)
- Calcium: 8.8 mg/dL (Normal: 8.5-10.2)
- Magnesium: 1.9 mg/dL (Normal: 1.7-2.2)

LIPID PANEL:
- Total Cholesterol: 220 mg/dL (Normal: <200) - HIGH
- LDL: 145 mg/dL (Normal: <100) - HIGH
- HDL: 35 mg/dL (Normal: >40 for males) - LOW
- Triglycerides: 180 mg/dL (Normal: <150) - ELEVATED

LIVER FUNCTION:
- ALT: 32 U/L (Normal: 7-56)
- AST: 28 U/L (Normal: 10-40)
- ALP: 65 U/L (Normal: 30-120)
- Bilirubin: 0.8 mg/dL (Normal: 0.1-1.2)

THYROID PANEL:
- TSH: 2.5 mIU/mL (Normal: 0.4-4.0)
- Free T4: 1.2 ng/dL (Normal: 0.8-1.8)
- Free T3: 3.5 pg/mL (Normal: 2.3-4.2)

INFLAMMATION MARKERS:
- ESR: 18 mm/hr (Normal: 0-20) - BORDERLINE
- CRP: 2.8 mg/L (Normal: <3) - BORDERLINE

MICRONUTRIENTS:
- Vitamin B12: 280 pg/mL (Normal: 200-900) - LOW
- Folate: 4.2 ng/mL (Normal: >5.4) - LOW
- Vitamin D: 22 ng/mL (Normal: 30-100) - DEFICIENT
- Iron: 55 µg/dL (Normal: 60-170) - LOW
- Ferritin: 45 ng/mL (Normal: 30-300)

=== CLINICAL FINDINGS ===

ABNORMALITIES DETECTED:
1. Elevated Fasting Glucose (115 mg/dL) - Indicates prediabetic state
2. High Total Cholesterol (220 mg/dL) - Cardiovascular risk
3. High LDL Cholesterol (145 mg/dL) - Bad cholesterol elevated
4. Low HDL Cholesterol (35 mg/dL) - Good cholesterol low
5. Elevated Triglycerides (180 mg/dL) - Fat metabolism issue
6. Low Hemoglobin (13.2 g/dL) - Mild anemia
7. Low Vitamin B12 (280 pg/mL) - Energy and nerve health concern
8. Low Folate (4.2 ng/mL) - Cell division concern
9. Deficient Vitamin D (22 ng/mL) - Bone and immune health
10. Low Iron (55 µg/dL) - Oxygen transport concern
11. Borderline ESR (18 mm/hr) - Possible inflammation
12. Borderline CRP (2.8 mg/L) - Possible inflammation

GRAY AREAS (Borderline):
- ESR at upper normal limit
- CRP near upper limit
- Hemoglobin slightly below normal
- Iron at lower end of normal

RECOMMENDATIONS:
1. Lifestyle modifications for glucose and cholesterol management
2. Increase physical activity to 150 minutes per week
3. Dietary changes to reduce refined carbohydrates and saturated fats
4. Increase intake of iron-rich foods and vitamin D sources
5. Consider supplementation for B12, Folate, Vitamin D, and Iron
6. Follow-up testing in 3 months
7. Consult with cardiologist for cardiovascular risk assessment
`;

async function runComprehensiveTest() {
  console.log('\n========== COMPREHENSIVE ANALYSIS TEST ==========\n');
  
  try {
    console.log('[TEST] Testing local analysis generation...\n');
    
    const analysis = generateAnalysisFromText(testReport);
    
    console.log('✅ ANALYSIS GENERATED SUCCESSFULLY\n');
    console.log('=== ANALYSIS RESULTS ===\n');
    
    console.log('Overall Health Status:', analysis.overallHealthStatus);
    console.log('Health Score:', analysis.healthScore);
    console.log('Summary:', analysis.summary);
    console.log('\n--- Key Findings ---');
    if (analysis.deficiencies && analysis.deficiencies.length > 0) {
      analysis.deficiencies.forEach((def, i) => {
        console.log(`${i + 1}. ${def.name} (${def.severity})`);
      });
    }
    
    console.log('\n--- Metrics Extracted ---');
    if (analysis.metrics && Object.keys(analysis.metrics).length > 0) {
      console.log('Total metrics found:', Object.keys(analysis.metrics).length);
      Object.entries(analysis.metrics).forEach(([name, data]) => {
        console.log(`${name}: ${data.value} ${data.unit} (Normal: ${data.normalRange})`);
      });
    } else {
      console.log('No metrics extracted');
    }
    
    console.log('\n--- Food Recommendations ---');
    if (analysis.foodRecommendations && Object.keys(analysis.foodRecommendations).length > 0) {
      Object.entries(analysis.foodRecommendations).forEach(([issue, rec]) => {
        console.log(`\n${issue}:`);
        console.log(`  Foods: ${rec.foods.join(', ')}`);
        console.log(`  Frequency: ${rec.frequency}`);
      });
    } else {
      console.log('No food recommendations generated');
    }
    
    console.log('\n--- Supplement Recommendations ---');
    if (analysis.supplementRecommendations && Object.keys(analysis.supplementRecommendations).length > 0) {
      Object.entries(analysis.supplementRecommendations).forEach(([issue, supplements]) => {
        console.log(`\n${issue}:`);
        supplements.forEach(supp => {
          console.log(`  - ${supp.name}: ${supp.dosage}`);
          console.log(`    Why: ${supp.whyItHelps}`);
        });
      });
    } else {
      console.log('No supplement recommendations generated');
    }
    
    console.log('\n--- Lifestyle Recommendations ---');
    if (analysis.recommendations && analysis.recommendations.lifestyle) {
      analysis.recommendations.lifestyle.forEach(rec => {
        console.log(`• ${rec}`);
      });
    }
    
    console.log('\n--- Diet Advice ---');
    if (analysis.recommendations && analysis.recommendations.diet) {
      console.log(analysis.recommendations.diet);
    }
    
    console.log('\n========== TEST COMPLETE ==========\n');
    
  } catch (error) {
    console.error('\n❌ TEST FAILED');
    console.error('Error:', error.message);
    console.error('Stack:', error.stack);
  }
}

runComprehensiveTest();
