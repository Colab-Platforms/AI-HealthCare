const { extractMetricsFromReport } = require('./server/services/aiService');

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
`;

console.log('\n========== METRIC EXTRACTION DEBUG ==========\n');

const { metrics, deficiencies } = extractMetricsFromReport(testReport);

console.log('Metrics extracted:', Object.keys(metrics).length);
console.log('\nMetrics found:');
Object.entries(metrics).forEach(([name, data]) => {
  console.log(`  ${name}: ${data.value} ${data.unit}`);
});

console.log('\nDeficiencies found:', deficiencies.length);
deficiencies.forEach(def => {
  console.log(`  - ${def.name} (${def.severity})`);
});

// Test individual regex patterns
console.log('\n========== REGEX PATTERN TESTS ==========\n');

const patterns = [
  { name: 'Hemoglobin', regex: /Hemoglobin[:\s-]+([0-9.]+)\s*g\/dL/i },
  { name: 'Glucose', regex: /(?:Fasting\s+)?Glucose[:\s-]+([0-9.]+)\s*mg\/dL/i },
  { name: 'Total Cholesterol', regex: /Total\s+Cholesterol[:\s-]+([0-9.]+)\s*mg\/dL/i },
  { name: 'LDL', regex: /LDL[:\s-]+([0-9.]+)\s*mg\/dL/i },
  { name: 'HDL', regex: /HDL[:\s-]+([0-9.]+)\s*mg\/dL/i },
  { name: 'Triglycerides', regex: /Triglycerides[:\s-]+([0-9.]+)\s*mg\/dL/i },
  { name: 'Vitamin B12', regex: /Vitamin\s+B12[:\s-]+([0-9.]+)\s*pg\/mL/i },
  { name: 'Folate', regex: /Folate[:\s-]+([0-9.]+)\s*ng\/mL/i },
  { name: 'Vitamin D', regex: /Vitamin\s+D[:\s-]+([0-9.]+)\s*ng\/mL/i },
  { name: 'Iron', regex: /Iron[:\s-]+([0-9.]+)\s*µg\/dL/i },
  { name: 'TSH', regex: /TSH[:\s-]+([0-9.]+)\s*mIU\/mL/i },
  { name: 'Free T4', regex: /Free\s+T4[:\s-]+([0-9.]+)\s*ng\/dL/i },
  { name: 'Free T3', regex: /Free\s+T3[:\s-]+([0-9.]+)\s*pg\/mL/i },
  { name: 'ESR', regex: /ESR[:\s-]+([0-9.]+)\s*mm\/hr/i },
  { name: 'CRP', regex: /CRP[:\s-]+([0-9.]+)\s*mg\/L/i },
];

patterns.forEach(pattern => {
  const match = testReport.match(pattern.regex);
  if (match) {
    console.log(`✅ ${pattern.name}: ${match[1]}`);
  } else {
    console.log(`❌ ${pattern.name}: NOT FOUND`);
  }
});
