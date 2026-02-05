require('dotenv').config();

// Read the aiService.js file and check the function definition
const fs = require('fs');
const content = fs.readFileSync('./services/aiService.js', 'utf8');

// Find the analyzeHealthReport function definition
const analyzeMatch = content.match(/exports\.analyzeHealthReport\s*=\s*async\s*\([^)]*\)\s*=>\s*\{[\s\S]*?\n\};/);
if (analyzeMatch) {
  console.log('[TEST] Found analyzeHealthReport function definition');
  console.log('[TEST] Function uses Claude:', analyzeMatch[0].includes('claude-3.5-sonnet'));
  console.log('[TEST] Function uses Gemini:', analyzeMatch[0].includes('google/gemini'));
  console.log('[TEST] Function first 500 chars:', analyzeMatch[0].substring(0, 500));
} else {
  console.log('[TEST] Could not find analyzeHealthReport function definition');
}

// Now import and check the actual exported function
const { analyzeHealthReport } = require('./services/aiService');
console.log('\n[TEST] Imported function uses Claude:', analyzeHealthReport.toString().includes('claude-3.5-sonnet'));
console.log('[TEST] Imported function uses Gemini:', analyzeHealthReport.toString().includes('google/gemini'));
