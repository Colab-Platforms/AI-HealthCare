/**
 * Verify which AI model is configured
 */

const path = require('path');
const aiServicePath = path.join(__dirname, 'server', 'services', 'aiService.js');

console.log('🔍 Checking AI Service Configuration...\n');
console.log('File path:', aiServicePath);
console.log('\n📄 Reading file...\n');

const fs = require('fs');
const content = fs.readFileSync(aiServicePath, 'utf8');

// Check for model configuration
const lines = content.split('\n').slice(0, 20);
console.log('First 20 lines of aiService.js:');
console.log('=' .repeat(60));
lines.forEach((line, i) => {
  console.log(`${(i+1).toString().padStart(2, '0')}: ${line}`);
});
console.log('=' .repeat(60));

// Check for Claude
if (content.includes('claude')) {
  console.log('\n❌ PROBLEM: File contains "claude" reference!');
  console.log('This should NOT be there.');
} else {
  console.log('\n✅ Good: No "claude" reference found in file.');
}

// Check for GPT models
if (content.includes('gpt-4-turbo')) {
  console.log('✅ Good: GPT-4-turbo found in file.');
} else {
  console.log('❌ PROBLEM: GPT-4-turbo NOT found in file!');
}

// Check for AI_MODELS array
if (content.includes('AI_MODELS')) {
  console.log('✅ Good: AI_MODELS array found.');
  
  // Extract the array
  const match = content.match(/const AI_MODELS = \[([\s\S]*?)\];/);
  if (match) {
    console.log('\n📋 Configured Models:');
    const models = match[1].split('\n').filter(l => l.trim().startsWith("'"));
    models.forEach(model => {
      console.log('  -', model.trim());
    });
  }
} else {
  console.log('❌ PROBLEM: AI_MODELS array NOT found!');
}

console.log('\n' + '='.repeat(60));
console.log('CONCLUSION:');
console.log('='.repeat(60));

if (content.includes('gpt-4-turbo') && !content.includes('claude')) {
  console.log('✅ File is CORRECT - has GPT models, no Claude');
  console.log('\n⚠️  If server logs still show Claude:');
  console.log('   1. Server is NOT restarted properly');
  console.log('   2. Node.js is caching old module');
  console.log('   3. Multiple servers might be running');
  console.log('\n🔧 FIX: Kill all node processes and restart:');
  console.log('   taskkill /F /IM node.exe');
  console.log('   cd healthcare-ai-platform/server');
  console.log('   npm start');
} else {
  console.log('❌ File has ISSUES - needs to be fixed');
}
