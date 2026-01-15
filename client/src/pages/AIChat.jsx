import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader2, Copy, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AIChat() {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedIndex, setCopiedIndex] = useState(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    // Add welcome message
    setMessages([
      {
        role: 'assistant',
        content: `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant. I can help you understand your health reports, answer questions about your symptoms, and provide general health guidance. How can I assist you today?`,
        timestamp: new Date()
      }
    ]);

    // If text was selected, add it as initial query
    if (location.state?.selectedText) {
      const selectedText = location.state.selectedText;
      setInput(`Can you explain this: "${selectedText}"`);
    }
  }, [location.state, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      // Simulate AI response (replace with actual API call)
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      const aiResponse = {
        role: 'assistant',
        content: generateAIResponse(input),
        timestamp: new Date()
      };

      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('AI Chat error:', error);
      toast.error('Failed to get AI response');
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = (query) => {
    // This is a placeholder. Replace with actual AI API integration
    const lowerQuery = query.toLowerCase();
    
    if (lowerQuery.includes('vitamin d') || lowerQuery.includes('vitamin-d')) {
      return `Based on your query about Vitamin D:\n\n**What is Vitamin D?**\nVitamin D is essential for bone health, immune function, and overall wellbeing.\n\n**Normal Range:** 30-100 ng/mL\n\n**If Low:**\n• Get 15-20 minutes of morning sunlight daily\n• Eat fish, eggs, fortified milk\n• Consider supplements (consult your doctor)\n\n**Symptoms of Deficiency:**\n• Fatigue and tiredness\n• Bone pain or weakness\n• Frequent infections\n• Mood changes\n\nWould you like more specific information about your levels?`;
    }
    
    if (lowerQuery.includes('iron') || lowerQuery.includes('hemoglobin')) {
      return `Regarding Iron and Hemoglobin:\n\n**Importance:**\nIron is crucial for producing hemoglobin, which carries oxygen in your blood.\n\n**Normal Hemoglobin:** 12-17 g/dL\n**Normal Iron:** 60-170 mcg/dL\n\n**To Increase Iron:**\n• Red meat, spinach, dal\n• Eat with Vitamin C foods\n• Avoid tea/coffee with meals\n\n**Symptoms of Low Iron:**\n• Extreme fatigue\n• Pale skin\n• Shortness of breath\n• Cold hands and feet\n\nConsult your doctor if symptoms persist.`;
    }

    if (lowerQuery.includes('diet') || lowerQuery.includes('food')) {
      return `For a healthy diet plan:\n\n**General Guidelines:**\n• Eat balanced meals with proteins, carbs, and healthy fats\n• Include plenty of fruits and vegetables\n• Stay hydrated (8-10 glasses of water daily)\n• Limit processed foods and sugar\n\n**Based on Your Health Data:**\nI can provide personalized diet recommendations based on your deficiencies. Check your Diet Plan page for detailed meal suggestions.\n\nWould you like specific recommendations for any nutrient?`;
    }

    return `Thank you for your question. I'm here to help with:\n\n• Understanding your health reports\n• Explaining medical terms and values\n• Providing general health guidance\n• Diet and lifestyle recommendations\n• Symptom information\n\n**Important:** I provide general information only. For medical diagnosis and treatment, please consult with a healthcare professional.\n\nCould you please provide more details about what you'd like to know?`;
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-slate-50">
      {/* Header */}
      <div className="bg-white border-b border-slate-200 px-4 sm:px-6 py-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center">
            <Bot className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-800">AI Health Assistant</h1>
            <p className="text-sm text-slate-500">Ask me anything about your health</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <div className="whitespace-pre-wrap break-words text-sm sm:text-base">
                {message.content}
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className={`text-xs ${message.role === 'user' ? 'text-white/70' : 'text-slate-400'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {message.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(message.content, index)}
                    className="text-slate-400 hover:text-slate-600 transition-colors"
                  >
                    {copiedIndex === index ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                )}
              </div>
            </div>

            {message.role === 'user' && (
              <div className="w-8 h-8 rounded-full bg-slate-200 flex items-center justify-center shrink-0">
                <User className="w-5 h-5 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin" />
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white border-t border-slate-200 px-4 sm:px-6 py-4">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about your health, symptoms, or reports..."
            className="flex-1 px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-2 focus:ring-cyan-500/20"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
        
        {/* Suggestions */}
        <div className="mt-3 flex flex-wrap gap-2">
          <button
            onClick={() => setInput('What do my vitamin levels mean?')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
          >
            Explain my vitamins
          </button>
          <button
            onClick={() => setInput('How can I improve my iron levels?')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
          >
            Improve iron levels
          </button>
          <button
            onClick={() => setInput('What foods should I eat?')}
            className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs transition-colors"
          >
            Diet suggestions
          </button>
        </div>
      </div>
    </div>
  );
}
