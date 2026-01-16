import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader2, Copy, Check, Trash2, RefreshCw } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import toast from 'react-hot-toast';

export default function AIChat() {
  const { user } = useAuth();
  const location = useLocation();
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [loadingReports, setLoadingReports] = useState(true);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  // Load user's reports for context
  useEffect(() => {
    const fetchUserReports = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/health/reports', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setUserReports(data.reports || []);
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
      } finally {
        setLoadingReports(false);
      }
    };

    fetchUserReports();
  }, []);

  // Load chat history from database
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/chat/history', {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages && data.messages.length > 0) {
            setMessages(data.messages.map(msg => ({
              role: msg.role,
              content: msg.content,
              timestamp: new Date(msg.timestamp)
            })));
          } else {
            // No history, show welcome message
            setMessages([
              {
                role: 'assistant',
                content: `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant. I have access to your health reports and can help you understand them. What would you like to know?`,
                timestamp: new Date()
              }
            ]);
          }
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Show welcome message on error
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant. How can I help you today?`,
            timestamp: new Date()
          }
        ]);
      }
    };

    if (user) {
      loadChatHistory();
    }

    // If text was selected, add it as initial query
    if (location.state?.selectedText) {
      const selectedText = location.state.selectedText;
      setInput(`Can you explain this: "${selectedText}"`);
    }
  }, [location.state, user]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, streamingText]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  // Streaming effect function
  const streamResponse = (text, callback) => {
    setStreaming(true);
    setStreamingText('');
    let index = 0;
    
    const interval = setInterval(() => {
      if (index < text.length) {
        setStreamingText(prev => prev + text[index]);
        index++;
      } else {
        clearInterval(interval);
        setStreaming(false);
        callback();
      }
    }, 20); // Adjust speed here (lower = faster)
    
    return () => clearInterval(interval);
  };

  const clearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      try {
        const token = localStorage.getItem('token');
        await fetch('/api/chat/history', {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${token}`
          }
        });
        
        setMessages([
          {
            role: 'assistant',
            content: `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant. How can I assist you today?`,
            timestamp: new Date()
          }
        ]);
        toast.success('Chat cleared');
      } catch (error) {
        console.error('Failed to clear chat:', error);
        toast.error('Failed to clear chat');
      }
    }
  };

  // Save message to database
  const saveMessageToDb = async (userQuery, aiResponse) => {
    try {
      const token = localStorage.getItem('token');
      await fetch('/api/chat/history', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          messages: [
            { role: 'user', content: userQuery, timestamp: new Date() },
            { role: 'assistant', content: aiResponse, timestamp: new Date() }
          ]
        })
      });
    } catch (error) {
      console.error('Failed to save message:', error);
    }
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
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      // Use simple chat endpoint (no auth required)
      const apiUrl = import.meta.env.PROD 
        ? `${window.location.origin}/api/chat`
        : '/api/chat';
      
      const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: currentInput,
          conversationHistory: messages.filter(m => !m.content.includes('Hello')).slice(-10),
          userReports: userReports.map(r => ({
            type: r.reportType,
            date: r.uploadDate,
            analysis: r.analysis,
            metrics: r.metrics
          }))
        })
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        console.error('API Error:', response.status, errorData);
        throw new Error(errorData.message || 'Failed to get AI response');
      }

      const data = await response.json();
      
      if (data.success && data.response) {
        // Stream the response with typing effect
        streamResponse(data.response, () => {
          const aiResponse = {
            role: 'assistant',
            content: data.response,
            timestamp: new Date()
          };
          setMessages(prev => [...prev, aiResponse]);
          setStreamingText('');
          
          // Save to database
          saveMessageToDb(currentInput, data.response);
        });
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      
      // Fallback to template response with streaming
      const fallbackResponse = generateAIResponse(currentInput);
      streamResponse(fallbackResponse, () => {
        const aiResponse = {
          role: 'assistant',
          content: fallbackResponse,
          timestamp: new Date()
        };
        setMessages(prev => [...prev, aiResponse]);
        setStreamingText('');
      });
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
    <div className="h-[calc(100vh-4rem)] flex flex-col bg-gradient-to-br from-slate-50 via-cyan-50/30 to-blue-50/30">
      {/* Messages */}
      <div 
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 sm:px-6 py-6 space-y-4"
        style={{ userSelect: 'text' }}
        onMouseUp={(e) => {
          // Prevent text selection popup on this page
          e.stopPropagation();
        }}
      >
        {messages.map((message, index) => (
          <div
            key={index}
            className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            {message.role === 'assistant' && (
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
                <Bot className="w-5 h-5 text-white" />
              </div>
            )}
            
            <div
              className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                message.role === 'user'
                  ? 'bg-gradient-to-r from-cyan-500 to-blue-500 text-white shadow-cyan-200'
                  : 'bg-white border border-slate-200 text-slate-800'
              }`}
            >
              <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed">
                {message.content}
              </div>
              <div className="flex items-center justify-between mt-2 gap-2">
                <span className={`text-xs ${message.role === 'user' ? 'text-white/70' : 'text-slate-400'}`}>
                  {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                </span>
                {message.role === 'assistant' && (
                  <button
                    onClick={() => copyToClipboard(message.content, index)}
                    className="text-slate-400 hover:text-cyan-600 transition-colors p-1 hover:bg-slate-100 rounded"
                    title="Copy response"
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
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-slate-200 to-slate-300 flex items-center justify-center shrink-0 shadow-sm">
                <User className="w-5 h-5 text-slate-600" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming message */}
        {streaming && streamingText && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="max-w-[80%] sm:max-w-[70%] bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed text-slate-800">
                {streamingText}
                <span className="inline-block w-1 h-4 bg-cyan-500 ml-1 animate-pulse"></span>
              </div>
            </div>
          </div>
        )}

        {/* Loading indicator */}
        {loading && !streaming && (
          <div className="flex gap-3 justify-start">
            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-cyan-500 to-blue-500 flex items-center justify-center shrink-0 shadow-md">
              <Bot className="w-5 h-5 text-white" />
            </div>
            <div className="bg-white border border-slate-200 rounded-2xl px-4 py-3 shadow-sm">
              <div className="flex items-center gap-2 text-slate-500">
                <Loader2 className="w-4 h-4 animate-spin text-cyan-500" />
                <span className="text-sm">Analyzing your question...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="bg-white/80 backdrop-blur-sm border-t border-slate-200/50 px-4 sm:px-6 py-4 shadow-lg">
        <form onSubmit={handleSubmit} className="flex gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about your health reports, symptoms, or get health advice..."
              className="w-full px-4 py-3 pr-10 bg-white border-2 border-slate-200 rounded-xl text-slate-800 placeholder-slate-400 focus:border-cyan-500 focus:outline-none focus:ring-4 focus:ring-cyan-500/10 transition-all"
              disabled={loading || streaming}
            />
            {input && (
              <button
                type="button"
                onClick={() => setInput('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 text-xl"
              >
                ×
              </button>
            )}
          </div>
          <button
            type="submit"
            disabled={!input.trim() || loading || streaming}
            className="px-6 py-3 bg-gradient-to-r from-cyan-500 to-blue-500 text-white rounded-xl font-medium hover:shadow-xl hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-2"
          >
            {loading || streaming ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <>
                <Send className="w-5 h-5" />
                <span className="hidden sm:inline">Send</span>
              </>
            )}
          </button>
        </form>
      </div>
    </div>
  );
}
