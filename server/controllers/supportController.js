const SupportTicket = require('../models/SupportTicket');
const Anthropic = require('@anthropic-ai/sdk');

// Initialize Claude client
const client = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

exports.createTicket = async (req, res) => {
    try{
        const { subject, message, category, attachments } = req.body;
        const userId = req.user._id;

        const ticket = await SupportTicket.create({
            user: userId,
            subject,
            message,
            category,
            attachments,
            status: 'open',
            priority: 'medium'
        });

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getMyTickets = async (req, res) => {
    try {
        const tickets = await SupportTicket.find({ user: req.user._id })
            .sort({ createdAt: -1 });
        res.json({ success: true, tickets });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};


exports.getAllTickets = async (req, res) => {
    try {
        const { status, category, page = 1, limit = 10 } = req.query;
        
        console.log('getAllTickets called by user:', req.user?._id, 'Role:', req.user?.role);
        
        const query = {};
        if (status) query.status = status;
        if (category) query.category = category;

        const tickets = await SupportTicket.find(query)
            .populate('user', 'name email profile.avatar')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit));

        const total = await SupportTicket.countDocuments(query);

        console.log('Returning tickets:', tickets.length, 'Total:', total);

        res.json({ 
            success: true, 
            tickets, 
            total, 
            pages: Math.ceil(total / limit),
            currentPage: parseInt(page)
        });
    } catch (error) {
        console.error('getAllTickets error:', error);
        res.status(500).json({ success: false, message: error.message });
    }
};

exports.respondToTicket = async (req, res) => {
    try {
        const { ticketId } = req.params;
        const { response, status } = req.body;

        const ticket = await SupportTicket.findByIdAndUpdate(
            ticketId,
            {
                adminResponse: response,
                status: status || 'in_progress',
                respondedAt: new Date()
            },
            { new: true }
        );

        res.json({ success: true, ticket });
    } catch (error) {
        res.status(500).json({ success: false, message: error.message });
    }
};

// AI Chat for platform support with streaming
exports.aiChat = async (req, res) => {
  try {
    const { message } = req.body;
    console.log('aiChat called with message:', message);

    if (!message || message.trim().length === 0) {
      return res.status(400).json({ success: false, message: 'Message cannot be empty' });
    }

    // Check for simple greetings and provide static responses
    const lowerMessage = message.toLowerCase().trim();
    let staticResponse = null;

    if (['hello', 'hi', 'hii', 'hey', 'hey there', 'whats up'].includes(lowerMessage)) {
      staticResponse = 'Hello! I am your take.health AI Assistant. How can I help you today?';
    } else if (['who are you', 'what is your name', 'who are you?'].includes(lowerMessage)) {
      staticResponse = 'I am the take.health AI Assistant. I help you with questions about our platform features like glucose tracking, nutrition logging, and health insights.';
    } else if (['what is take.health', 'what is take health', 'tell me about take.health', 'tell me about take health'].includes(lowerMessage)) {
      staticResponse = 'take.health is an AI-powered health platform that helps you track health metrics, manage nutrition, monitor glucose levels, sync with wearables, and connect with doctors. Everything in one place for your wellness!';
    } else if (['thanks', 'thank you', 'ok', 'okay', 'got it', 'thanks for help'].includes(lowerMessage)) {
      staticResponse = 'You\'re welcome! Feel free to ask if you have any other questions about take.health.';
    }

    // If static response exists, send it without calling Claude
    if (staticResponse) {
      console.log('Sending static response:', staticResponse);
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      
      // Send the static response as chunks
      res.write(`data: ${JSON.stringify({ chunk: staticResponse })}\n\n`);
      res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
      res.end();
      return;
    }

    // Set headers for streaming
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');

    // Stream AI response
    await streamAIChatResponse(message, res);
  } catch (error) {
    console.error('AI Chat Error:', error);
    if (!res.headersSent) {
      res.status(500).json({ success: false, message: 'Failed to get AI response' });
    } else {
      res.write(`data: ${JSON.stringify({ error: 'Stream error' })}\n\n`);
      res.end();
    }
  }
};

// Helper function to stream AI responses using Claude
async function streamAIChatResponse(userMessage, res) {
  try {
    const systemPrompt = `You are a concise AI Assistant for the take.health platform. Keep ALL responses short - 2-3 sentences maximum unless specifically asked for details.

PLATFORM FEATURES:
- Glucose/Blood Sugar tracking
- Medical records vault
- Nutrition & meal logging
- Wearable device sync
- Health metrics (weight, BP, heart rate)
- Doctor consultations
- Diet recommendations

STRICT RULES:
1. Answer ONLY about take.health features
2. NO emojis ever
3. Keep responses under 100 words
4. For how-to: Use 1-2 sentences max with simple steps
5. Redirect off-topic questions to platform features
6. Be direct and brief`;

    console.log('Starting Claude streaming with message:', userMessage);

    const stream = await client.messages.stream({
      model: "claude-sonnet-4-6",
      max_tokens: 200,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: userMessage
        }
      ]
    });

    // Send data in chunks as stream progresses
    for await (const chunk of stream) {
      if (chunk.type === 'content_block_delta' && chunk.delta.type === 'text_delta') {
        const text = chunk.delta.text;
        // Send each chunk as Server-Sent Event
        res.write(`data: ${JSON.stringify({ chunk: text })}\n\n`);
        console.log('Sent chunk:', text);
      }
    }

    // Send end signal
    res.write(`data: ${JSON.stringify({ done: true })}\n\n`);
    res.end();
    console.log('Stream completed');
  } catch (error) {
    console.error('Claude Streaming Error:', error);
    console.error('Error message:', error.message);
    res.write(`data: ${JSON.stringify({ error: error.message })}\n\n`);
    res.end();
  }
}
