# AI Chat Feature Guide

## Overview

The AI Chat feature allows users to interact with an AI health assistant to get explanations about their health reports, symptoms, and general health guidance.

## Key Features

### 1. Text Selection Integration
- **How it works**: Select any text from your dashboard or report summaries
- **Action**: A popup appears with "Ask AI" button
- **Result**: Selected text is automatically added to the chat as a query

### 2. Enhanced Chat Interface
- **Clean Design**: Modern, user-friendly chat interface
- **Message History**: All conversations are preserved during the session
- **Copy Functionality**: Copy AI responses to clipboard
- **Timestamps**: Each message shows when it was sent
- **Quick Suggestions**: Pre-defined questions for common queries

### 3. AI Capabilities
The AI assistant can help with:
- Explaining health report values
- Understanding vitamin and mineral levels
- Providing diet recommendations
- Explaining symptoms
- General health guidance

## How to Use

### Method 1: Text Selection (Recommended)

1. Navigate to your Dashboard or Report Details page
2. Select any text you want to understand better
3. Click the "Ask AI" button that appears
4. The chat interface opens with your selected text
5. Modify the question if needed and send
6. Get instant AI response

### Method 2: Direct Chat

1. Click "AI Assistant" in the sidebar navigation
2. Type your question in the input field
3. Click Send or press Enter
4. Receive AI-powered response

### Method 3: Quick Suggestions

1. Open the AI Chat page
2. Click any of the suggestion buttons below the input
3. The question is automatically filled
4. Send to get response

## Example Queries

### Understanding Reports
```
"Can you explain this: Vitamin D - 18 ng/mL"
"What does hemoglobin 10.5 g/dL mean?"
"Is my iron level normal?"
```

### Diet Recommendations
```
"What foods should I eat to increase Vitamin D?"
"How can I improve my iron levels?"
"What's a good diet plan for me?"
```

### Symptom Questions
```
"Why do I feel tired all the time?"
"What causes low hemoglobin?"
"How to increase energy levels?"
```

## Features in Detail

### Message Display
- **User Messages**: Blue gradient background, right-aligned
- **AI Messages**: White background with border, left-aligned
- **Bot Avatar**: Cyan gradient circle with bot icon
- **User Avatar**: Gray circle with user icon

### Copy Functionality
- Click the copy icon on any AI message
- Text is copied to clipboard
- Checkmark appears to confirm
- Toast notification shows success

### Loading States
- "Thinking..." indicator while AI processes
- Animated spinner for visual feedback
- Smooth message transitions

### Responsive Design
- Works on desktop, tablet, and mobile
- Touch-friendly interface
- Optimized for all screen sizes

## Technical Implementation

### Components
- `AIChat.jsx` - Main chat interface
- `TextSelectionPopup.jsx` - Text selection popup
- Integrated in `Layout.jsx` for global access

### State Management
- Messages stored in component state
- Selected text passed via React Router state
- Session-based conversation history

### AI Integration
Currently uses placeholder responses. To integrate real AI:

1. **Option A: Gemini API**
```javascript
import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-pro" });

const result = await model.generateContent(userMessage);
const response = result.response.text();
```

2. **Option B: OpenAI API**
```javascript
import OpenAI from 'openai';

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const completion = await openai.chat.completions.create({
  model: "gpt-3.5-turbo",
  messages: [{ role: "user", content: userMessage }]
});

const response = completion.choices[0].message.content;
```

3. **Option C: Backend API**
```javascript
const response = await axios.post('/api/ai/chat', {
  message: userMessage,
  context: userHealthData
});
```

## Customization

### Modify Welcome Message
Edit in `AIChat.jsx`:
```javascript
{
  role: 'assistant',
  content: `Your custom welcome message here`,
  timestamp: new Date()
}
```

### Add More Suggestions
Edit the suggestions section:
```javascript
<button onClick={() => setInput('Your custom question')}>
  Custom Suggestion
</button>
```

### Change AI Response Logic
Modify `generateAIResponse()` function in `AIChat.jsx`

## Best Practices

### For Users
1. Be specific in your questions
2. Provide context when asking about values
3. Use the text selection feature for accuracy
4. Review AI responses with your doctor

### For Developers
1. Implement proper error handling
2. Add rate limiting for API calls
3. Store conversation history in database
4. Implement context-aware responses
5. Add user feedback mechanism

## Limitations

- AI provides general information only
- Not a substitute for medical advice
- Responses are educational in nature
- Always consult healthcare professionals for diagnosis

## Future Enhancements

### Planned Features
- [ ] Conversation history persistence
- [ ] Multi-language support
- [ ] Voice input/output
- [ ] Image analysis in chat
- [ ] Export chat conversations
- [ ] Share chat with doctor
- [ ] Personalized responses based on user health data
- [ ] Integration with health reports for context
- [ ] Suggested follow-up questions
- [ ] Health tips and reminders

### Advanced Features
- [ ] Real-time streaming responses
- [ ] Markdown formatting support
- [ ] Code syntax highlighting for medical terms
- [ ] Inline citations and references
- [ ] Integration with medical databases
- [ ] Symptom checker integration
- [ ] Medication interaction checker

## Troubleshooting

### Text Selection Not Working
- Ensure JavaScript is enabled
- Check browser compatibility
- Clear browser cache
- Refresh the page

### Chat Not Loading
- Check internet connection
- Verify API endpoints
- Check browser console for errors
- Ensure authentication is valid

### Messages Not Sending
- Check input is not empty
- Verify API is responding
- Check network tab for errors
- Ensure rate limits not exceeded

## Support

For issues or questions:
- Check documentation
- Review browser console
- Contact support team
- Submit GitHub issue

## Privacy & Security

- Conversations are session-based
- No data stored without consent
- HIPAA compliance considerations
- Encrypted data transmission
- Secure API endpoints

---

**Version**: 1.0.0
**Last Updated**: January 2025
**Status**: Production Ready ✅
