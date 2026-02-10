require('dotenv').config();
const { analyzeHealthReport } = require('./services/aiService');

// Sample blood test report text (realistic format)
const sampleReportText = `
BLOOD TEST REPORT

Patient Name: John Doe
Age: 35 years
Gender: Male
Report Date: 2024-02-07
Lab: City Medical Laboratory

COMPLETE BLOOD COUNT (CBC)

Test Name                Value       Unit        Reference Range    Status
---------------------------------------------------------------------------
Hemoglobin              14.5        g/dL        13.0-17.0          Normal
RBC Count               4.8         million/µL  4.5-5.5            Normal
WBC Count               7.2         10^3/µL     4.0-11.0           Normal
Platelet Count          250         10^3/µL     150-400            Normal
Hematocrit              42          %           40-50              Normal

LIPID PROFILE

Total Cholesterol       220         mg/dL       <200               High
LDL Cholesterol         145         mg/dL       <100               High
HDL Cholesterol         45          mg/dL       >40                Normal
Triglycerides           180         mg/dL       <150               High

BLOOD SUGAR

Fasting Glucose         105         mg/dL       70-100             High
HbA1c                   5.8         %           <5.7               Borderline

VITAMINS & MINERALS

Vitamin D               18          ng/mL       30-100             Low
Vitamin B12             350         pg/mL       200-900            Normal
Iron                    65          µg/dL       60-170             Normal
Calcium                 9.2         mg/dL       8.5-10.5           Normal

LIVER FUNCTION

SGPT (ALT)              28          U/L         <40                Normal
SGOT (AST)              32          U/L         <40                Normal

KIDNEY FUNCTION

Creatinine              0.9         mg/dL       0.7-1.3            Normal
Urea                    25          mg/dL       15-40              Normal
Uric Acid               7.5         mg/dL       3.5-7.2            High

THYROID

TSH                     2.5         µIU/mL      0.5-5.0            Normal
T3                      1.2         ng/mL       0.8-2.0            Normal
T4                      8.5         µg/dL       5.0-12.0           Normal

Doctor's Notes:
- Elevated cholesterol and triglycerides - recommend dietary changes
- Low Vitamin D - supplement recommended
- Slightly elevated uric acid - monitor and adjust diet
- Borderline HbA1c - lifestyle modifications needed
`;

console.log('🧪 Testing AI Analysis with Sample Report\n');
console.log('=' .repeat(60));

async function testAnalysis() {
  try {
    console.log('📝 Sample Report Text Length:', sampleReportText.length, 'characters\n');
    
    console.log('🔄 Calling AI Analysis...\n');
    const startTime = Date.now();
    
    const analysis = await analyzeHealthReport(sampleReportText, {
      age: 35,
      gender: 'Male'
    });
    
    const duration = ((Date.now() - startTime) / 1000).toFixed(2);
    console.log(`\n✅ Analysis completed in ${duration} seconds\n`);
    
    console.log('=' .repeat(60));
    console.log('📊 ANALYSIS RESULTS');
    console.log('=' .repeat(60));
    
    console.log('\n👤 PATIENT INFO:');
    console.log('   Name:', analysis.patientName);
    console.log('   Age:', analysis.patientAge);
    console.log('   Gender:', analysis.patientGender);
    console.log('   Report Date:', analysis.reportDate);
    
    console.log('\n💯 HEALTH SCORE:', analysis.healthScore);
    
    console.log('\n📋 SUMMARY:');
    console.log('  ', analysis.summary);
    
    console.log('\n🔍 KEY FINDINGS:');
    if (analysis.keyFindings && analysis.keyFindings.length > 0) {
      analysis.keyFindings.forEach((finding, i) => {
        console.log(`   ${i + 1}. ${finding}`);
      });
    } else {
      console.log('   ❌ No key findings');
    }
    
    console.log('\n🧪 METRICS EXTRACTED:');
    if (analysis.metrics && Object.keys(analysis.metrics).length > 0) {
      Object.entries(analysis.metrics).forEach(([key, metric]) => {
        const statusIcon = metric.status === 'normal' ? '✅' : 
                          metric.status === 'high' ? '⬆️' : 
                          metric.status === 'low' ? '⬇️' : '❓';
        console.log(`   ${statusIcon} ${key}: ${metric.value} ${metric.unit} (${metric.status}) [Normal: ${metric.normalRange}]`);
      });
    } else {
      console.log('   ❌ No metrics extracted');
    }
    
    console.log('\n⚠️  DEFICIENCIES:');
    if (analysis.deficiencies && analysis.deficiencies.length > 0) {
      analysis.deficiencies.forEach((def, i) => {
        console.log(`   ${i + 1}. ${def.name} (${def.severity})`);
        if (def.currentValue) {
          console.log(`      Current: ${def.currentValue} | Normal: ${def.normalRange}`);
        }
      });
    } else {
      console.log('   ✅ No deficiencies detected');
    }
    
    console.log('\n💊 SUPPLEMENTS:');
    if (analysis.supplements && analysis.supplements.length > 0) {
      analysis.supplements.forEach((supp, i) => {
        console.log(`   ${i + 1}. ${supp.category}`);
        console.log(`      Reason: ${supp.reason}`);
        if (supp.naturalSources) {
          console.log(`      Natural Sources: ${supp.naturalSources}`);
        }
      });
    } else {
      console.log('   ℹ️  No supplements recommended');
    }
    
    console.log('\n🍽️  DIET PLAN:');
    if (analysis.dietPlan) {
      console.log('   Overview:', analysis.dietPlan.overview || 'N/A');
      console.log('\n   Breakfast:', analysis.dietPlan.breakfast?.length || 0, 'meals');
      if (analysis.dietPlan.breakfast && analysis.dietPlan.breakfast.length > 0) {
        analysis.dietPlan.breakfast.forEach((meal, i) => {
          console.log(`      ${i + 1}. ${meal.meal}`);
          if (meal.tip) console.log(`         💡 ${meal.tip}`);
        });
      }
      
      console.log('\n   Lunch:', analysis.dietPlan.lunch?.length || 0, 'meals');
      if (analysis.dietPlan.lunch && analysis.dietPlan.lunch.length > 0) {
        analysis.dietPlan.lunch.forEach((meal, i) => {
          console.log(`      ${i + 1}. ${meal.meal}`);
        });
      }
      
      console.log('\n   Dinner:', analysis.dietPlan.dinner?.length || 0, 'meals');
      if (analysis.dietPlan.dinner && analysis.dietPlan.dinner.length > 0) {
        analysis.dietPlan.dinner.forEach((meal, i) => {
          console.log(`      ${i + 1}. ${meal.meal}`);
        });
      }
      
      console.log('\n   Snacks:', analysis.dietPlan.snacks?.length || 0, 'options');
      if (analysis.dietPlan.snacks && analysis.dietPlan.snacks.length > 0) {
        analysis.dietPlan.snacks.forEach((meal, i) => {
          console.log(`      ${i + 1}. ${meal.meal}`);
        });
      }
      
      console.log('\n   Foods to Increase:', analysis.dietPlan.foodsToIncrease?.length || 0);
      console.log('   Foods to Limit:', analysis.dietPlan.foodsToLimit?.length || 0);
      console.log('   Health Tips:', analysis.dietPlan.tips?.length || 0);
    } else {
      console.log('   ❌ No diet plan generated');
    }
    
    console.log('\n💡 RECOMMENDATIONS:');
    if (analysis.recommendations) {
      if (analysis.recommendations.lifestyle && analysis.recommendations.lifestyle.length > 0) {
        console.log('   Lifestyle:', analysis.recommendations.lifestyle.length, 'recommendations');
        analysis.recommendations.lifestyle.forEach((rec, i) => {
          console.log(`      ${i + 1}. ${rec}`);
        });
      }
      if (analysis.recommendations.tests && analysis.recommendations.tests.length > 0) {
        console.log('   Follow-up Tests:', analysis.recommendations.tests.length);
        analysis.recommendations.tests.forEach((test, i) => {
          console.log(`      ${i + 1}. ${test}`);
        });
      }
    }
    
    console.log('\n' + '=' .repeat(60));
    console.log('✅ TEST COMPLETE');
    console.log('=' .repeat(60));
    
    // Validation checks
    console.log('\n🔍 VALIDATION CHECKS:');
    const checks = [
      { name: 'Patient name extracted', pass: analysis.patientName && analysis.patientName !== 'Patient' },
      { name: 'Health score is number', pass: typeof analysis.healthScore === 'number' },
      { name: 'Metrics have values', pass: analysis.metrics && Object.values(analysis.metrics).some(m => m.value !== null) },
      { name: 'Deficiencies detected', pass: analysis.deficiencies && analysis.deficiencies.length > 0 },
      { name: 'Supplements recommended', pass: analysis.supplements && analysis.supplements.length > 0 },
      { name: 'Diet plan has breakfast', pass: analysis.dietPlan?.breakfast?.length >= 3 },
      { name: 'Diet plan has lunch', pass: analysis.dietPlan?.lunch?.length >= 3 },
      { name: 'Diet plan has dinner', pass: analysis.dietPlan?.dinner?.length >= 3 },
      { name: 'Diet plan has snacks', pass: analysis.dietPlan?.snacks?.length >= 3 },
      { name: 'Key findings present', pass: analysis.keyFindings && analysis.keyFindings.length > 0 }
    ];
    
    checks.forEach(check => {
      const icon = check.pass ? '✅' : '❌';
      console.log(`   ${icon} ${check.name}`);
    });
    
    const passedChecks = checks.filter(c => c.pass).length;
    const totalChecks = checks.length;
    console.log(`\n   Score: ${passedChecks}/${totalChecks} checks passed`);
    
    if (passedChecks === totalChecks) {
      console.log('\n   🎉 ALL CHECKS PASSED! AI is working correctly.');
    } else if (passedChecks >= totalChecks * 0.7) {
      console.log('\n   ⚠️  MOSTLY WORKING - Some improvements needed.');
    } else {
      console.log('\n   ❌ NEEDS ATTENTION - Multiple issues detected.');
    }
    
  } catch (error) {
    console.error('\n❌ TEST FAILED:', error.message);
    console.error('\nFull error:', error);
  }
}

testAnalysis();
