const dotenv = require('dotenv');
dotenv.config();

const { analyzeHealthReport } = require('./services/aiService');

// Sample health report text
const sampleReport = `
BLOOD TEST REPORT
Patient Name: Mr. Kiran Bansale
Age: 34 years
Gender: Male
Report Date: 14/01/2026

HEMATOLOGY
Hemoglobin: 15.2 g/dL (Normal: 12.0-16.0)
WBC: 7.5 cells/cumm (Normal: 4000-11000)
RBC: 5.0 million/cumm (Normal: 4.5-5.5)
Platelets: 2.5 lakhs/cumm (Normal: 1.5-4.5)
MCV: 77.51 fL (Normal: 80-100)
MCH: 25.89 pg (Normal: 27-34)

BIOCHEMISTRY
Fasting Glucose: 105 mg/dL (Normal: 70-99)
Total Cholesterol: 220 mg/dL (Normal: <200)
LDL: 150 mg/dL (Normal: <100)
HDL: 35 mg/dL (Normal: >60)
Triglycerides: 180 mg/dL (Normal: <150)

THYROID FUNCTION
TSH: 2.5 mIU/mL (Normal: 0.4-4.0)

VITAMINS
Vitamin D: 18.81 ng/mL (Normal: 30-100)
Vitamin B12: 112 pg/mL (Normal: 222-1439)

LIVER FUNCTION
SGOT: 35 U/L (Normal: 10-40)
SGPT: 28 U/L (Normal: 7-56)

KIDNEY FUNCTION
Creatinine: 0.9 mg/dL (Normal: 0.7-1.3)
Urea: 28 mg/dL (Normal: 15-45)

IRON PROFILE
Serum Iron: 101.64 µg/dL (Normal: 45-158)
Transferrin Saturation: 24.67% (Normal: 13-45)
`;

async function testAnalysis() {
  console.log('\n\n========== STARTING FULL ANALYSIS TEST ==========\n');
  
  try {
    const result = await analyzeHealthReport(sampleReport, {
      age: 34,
      gender: 'male'
    });
    
    console.log('\n========== ANALYSIS RESULT ==========');
    console.log('Summary:', result.summary);
    console.log('Health Score:', result.healthScore);
    console.log('Metrics count:', Object.keys(result.metrics).length);
    console.log('Deficiencies:', result.deficiencies.map(d => d.name));
    console.log('========== END RESULT ==========\n');
    
  } catch (error) {
    console.error('Test failed:', error);
  }
}

testAnalysis();
