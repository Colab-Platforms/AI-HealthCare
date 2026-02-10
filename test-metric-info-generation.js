// Test script to verify generateMetricInfo works correctly
require('dotenv').config({ path: './server/.env' });
const { generateMetricInfo } = require('./server/services/aiService');

async function testMetricInfo() {
  console.log('🧪 Testing generateMetricInfo function...\n');
  
  const testCases = [
    { name: 'glucose Fasting', value: '110', normalRange: '70-99', unit: 'mg/dL' },
    { name: 'gamma G T', value: '45', normalRange: '0-40', unit: 'U/L' },
    { name: 'hemoglobin', value: '12.5', normalRange: '13-17', unit: 'g/dL' }
  ];
  
  for (const test of testCases) {
    console.log(`\n📊 Testing: ${test.name}`);
    console.log(`Value: ${test.value} ${test.unit}, Normal: ${test.normalRange}`);
    console.log('─'.repeat(60));
    
    try {
      const result = await generateMetricInfo(
        test.name,
        test.value,
        test.normalRange,
        test.unit
      );
      
      console.log('\n✅ Result received:');
      console.log('Has "en" key:', !!result.en);
      console.log('Has "hi" key:', !!result.hi);
      
      if (result.en) {
        console.log('\n📝 English content:');
        console.log('  name:', result.en.name);
        console.log('  whatIsIt:', result.en.whatIsIt?.substring(0, 80) + '...');
        console.log('  whenHighEffects:', result.en.whenHighEffects?.length, 'items');
        console.log('  whenLowEffects:', result.en.whenLowEffects?.length, 'items');
        console.log('  solutions:', result.en.solutions?.length, 'items');
      }
      
      if (result.hi) {
        console.log('\n📝 Hindi content:');
        console.log('  name:', result.hi.name);
        console.log('  whatIsIt:', result.hi.whatIsIt?.substring(0, 80) + '...');
      }
      
      console.log('\n✅ Test PASSED for', test.name);
      
    } catch (error) {
      console.error('\n❌ Test FAILED for', test.name);
      console.error('Error:', error.message);
      console.error('Stack:', error.stack);
    }
    
    console.log('\n' + '='.repeat(60));
  }
  
  console.log('\n🏁 All tests completed!');
}

testMetricInfo().catch(console.error);
