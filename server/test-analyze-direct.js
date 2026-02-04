require('dotenv').config();

// Clear require cache to ensure we get the latest version
delete require.cache[require.resolve('./services/aiService')];

const aiService = require('./services/aiService');
console.log('[TEST] aiService exports:', Object.keys(aiService));
console.log('[TEST] analyzeHealthReport exists:', !!aiService.analyzeHealthReport);

const { analyzeHealthReport } = aiService;

const sampleReport = `
HEALTH REPORT - BLOOD TEST ANALYSIS
Date: 2024-01-31
Patient: Test Patient

HEMOGLOBIN: 13.5 g/dL (Normal: 12-16)
BLOOD PRESSURE: 120/80 mmHg (Normal)
VITAMIN D: 25 ng/mL (Low: <30)
VITAMIN B12: 350 pg/mL (Borderline: 200-900)
IRON: 65 µg/dL (Low: 60-170)

FINDINGS:
- Slightly low vitamin D levels
- Borderline B12 levels
- Iron levels at lower end of normal

RECOMMENDATIONS:
- Increase sun exposure
- Consider vitamin D supplementation
- Monitor B12 levels
- Increase iron-rich foods in diet
`;

async function test() {
  console.log('\n========== DIRECT FUNCTION TEST START ==========\n');
  console.log('[TEST] About to call analyzeHealthReport directly...');
  console.log('[TEST] Function type:', typeof analyzeHealthReport);
  console.log('[TEST] Function name:', analyzeHealthReport.name);
  console.log('[TEST] Function length:', analyzeHealthReport.length);
  
  // Get the full function toString
  const funcStr = analyzeHealthReport.toString();
  console.log('[TEST] Function uses Claude:', funcStr.includes('claude-3.5-sonnet'));
  console.log('[TEST] Function uses Gemini:', funcStr.includes('google/gemini'));
  console.log('[TEST] Function first 500 chars:', funcStr.substring(0, 500));
  
  console.log('[TEST] API Key exists:', !!process.env.OPENROUTER_API_KEY);
  console.log('[TEST] API Key (first 20 chars):', process.env.OPENROUTER_API_KEY?.substring(0, 20));
  
  try {
    const result = await analyzeHealthReport(sampleReport, { age: 30, gender: 'male' });
    console.log('\n[TEST] ✅ Function returned successfully');
    console.log('[TEST] Health score:', result.healthScore);
    console.log('[TEST] Summary:', result.summary?.substring(0, 100));
  } catch (error) {
    console.error('\n[TEST] ❌ Function failed');
    console.error('[TEST] Error:', error.message);
    console.error('[TEST] Stack:', error.stack);
  }
  
  console.log('\n========== DIRECT FUNCTION TEST END ==========\n');
  process.exit(0);
}

test();
