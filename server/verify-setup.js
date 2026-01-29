#!/usr/bin/env node

/**
 * Verification script to check if the server setup is correct
 * Run: node verify-setup.js
 */

const fs = require('fs');
const path = require('path');

console.log('\n=== Healthcare AI Platform - Server Setup Verification ===\n');

let allGood = true;

// Check 1: Environment variables
console.log('1. Checking environment variables...');
try {
  require('dotenv').config();
  
  const requiredVars = ['OPENROUTER_API_KEY', 'MONGODB_URI', 'JWT_SECRET'];
  const missingVars = requiredVars.filter(v => !process.env[v]);
  
  if (missingVars.length > 0) {
    console.log(`   ❌ Missing: ${missingVars.join(', ')}`);
    allGood = false;
  } else {
    console.log('   ✅ All required environment variables set');
  }
} catch (error) {
  console.log(`   ❌ Error reading .env: ${error.message}`);
  allGood = false;
}

// Check 2: Required files
console.log('\n2. Checking required files...');
const requiredFiles = [
  'server.js',
  'routes/chatRoutes.js',
  'routes/authRoutes.js',
  'routes/healthRoutes.js',
  'config/db.js'
];

requiredFiles.forEach(file => {
  const filePath = path.join(__dirname, file);
  if (fs.existsSync(filePath)) {
    console.log(`   ✅ ${file}`);
  } else {
    console.log(`   ❌ ${file} - NOT FOUND`);
    allGood = false;
  }
});

// Check 3: Dependencies
console.log('\n3. Checking dependencies...');
const requiredDeps = ['express', 'mongoose', 'axios', 'cors', 'dotenv'];
const packageJson = require('./package.json');

requiredDeps.forEach(dep => {
  if (packageJson.dependencies[dep]) {
    console.log(`   ✅ ${dep}`);
  } else {
    console.log(`   ❌ ${dep} - NOT INSTALLED`);
    allGood = false;
  }
});

// Check 4: Port availability
console.log('\n4. Checking port 5000...');
const net = require('net');
const server = net.createServer();

server.once('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.log('   ⚠️  Port 5000 is already in use');
    console.log('   (This is OK if server is already running)');
  } else {
    console.log(`   ❌ Error: ${err.message}`);
    allGood = false;
  }
  server.close();
});

server.once('listening', () => {
  console.log('   ✅ Port 5000 is available');
  server.close();
});

server.listen(5000, '127.0.0.1', () => {
  server.close();
});

// Check 5: API Key format
console.log('\n5. Checking API key format...');
const apiKey = process.env.OPENROUTER_API_KEY;
if (apiKey && apiKey.startsWith('sk-or-v1-')) {
  console.log('   ✅ OpenRouter API key format is correct');
} else if (apiKey) {
  console.log('   ⚠️  API key format may be incorrect');
  console.log(`   Expected: sk-or-v1-...`);
  console.log(`   Got: ${apiKey.substring(0, 20)}...`);
} else {
  console.log('   ❌ OpenRouter API key not set');
  allGood = false;
}

// Summary
console.log('\n=== Summary ===\n');
if (allGood) {
  console.log('✅ All checks passed! Server should be ready to run.');
  console.log('\nStart server with: npm run dev\n');
} else {
  console.log('❌ Some checks failed. Please fix the issues above.\n');
}

process.exit(allGood ? 0 : 1);
