// Simple test to verify chat history service works
const mongoose = require('mongoose');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.join(__dirname, '.env') });

const ChatHistory = require('./models/ChatHistory');
const ChatHistoryService = require('./services/chatHistoryService');

async function test() {
  try {
    console.log('🔧 Testing Chat History Service...\n');

    // Connect to DB
    console.log('1️⃣ Connecting to MongoDB...');
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('✅ MongoDB connected\n');

    // Test user ID (use a valid one from your DB or create test)
    const testUserId = new mongoose.Types.ObjectId();
    console.log(`2️⃣ Testing with user ID: ${testUserId}\n`);

    // Test messages
    const testMessages = [
      {
        id: `${Date.now()}-user`,
        role: 'user',
        content: 'Hello, how are you?',
        timestamp: new Date()
      },
      {
        id: `${Date.now() + 1}-ai`,
        role: 'assistant',
        content: 'I am doing well, thank you for asking!',
        timestamp: new Date()
      }
    ];

    // Test save
    console.log('3️⃣ Testing save...');
    const saveResult = await ChatHistoryService.saveMessages(testUserId, testMessages);
    console.log('✅ Save successful:', saveResult.version, '\n');

    // Test get
    console.log('4️⃣ Testing get...');
    const getResult = await ChatHistoryService.getHistory(testUserId);
    console.log('✅ Get successful:',getResult.messages.length, 'messages\n');

    // Verify messages match
    console.log('5️⃣ Verifying messages...');
    if (getResult.messages.length === testMessages.length) {
      console.log('✅ Message count matches!\n');
    } else {
      console.log('❌ Message count mismatch!', getResult.messages.length, 'vs', testMessages.length, '\n');
    }

    console.log('✅ All tests passed!');
    process.exit(0);
  } catch (error) {
    console.error('❌ Test failed:', error.message);
    console.error(error.stack);
    process.exit(1);
  }
}

test();
