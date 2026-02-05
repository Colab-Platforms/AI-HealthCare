import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Sparkles, Loader2, Copy, Check, Trash2, RefreshCw, Menu, X as XIcon, MessageSquare } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [chatSessions, setChatSessions] = useState([]);
  const [currentSessionId, setCurrentSessionId] = useState(null);
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

  // Load chat sessions from localStorage
  useEffect(() => {
    const loadChatSessions = () => {
      try {
        const sessions = localStorage.getItem(`chat_sessions_${user?.id}`);
        if (sessions) {
          const parsedSessions = JSON.parse(sessions);
          setChatSessions(parsedSessions);
        }
      } catch (error) {
        console.error('Failed to load chat sessions:', error);
      }
    };

    if (user) {
      loadChatSessions();
    }
  }, [user?.id]);

  // Load chat history from localStorage on mount
  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        // Generate session ID if not exists
        const sessionId = currentSessionId || `session_${Date.now()}`;
        setCurrentSessionId(sessionId);

        // Try to load from localStorage first
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}_${sessionId}`);
        if (savedMessages) {
          const parsedMessages = JSON.parse(savedMessages);
          setMessages(parsedMessages);
        } else {
          // Create greeting with report context
          const greeting = generateGreetingWithReports();
          setMessages([
            {
              role: 'assistant',
              content: greeting,
              timestamp: new Date()
            }
          ]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        const greeting = generateGreetingWithReports();
        setMessages([
          {
            role: 'assistant',
            content: greeting,
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
  }, [user?.id, location.state, user?.name, currentSessionId]);

  const generateGreetingWithReports = () => {
    let greeting = `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant.\n\n`;
    
    if (userReports && userReports.length > 0) {
      greeting += `I've reviewed your uploaded health reports:\n\n`;
      
      userReports.slice(0, 3).forEach((report, idx) => {
        const date = new Date(report.uploadDate).toLocaleDateString();
        greeting += `📋 **${report.reportType}** (${date})\n`;
        
        if (report.analysis) {
          const summary = report.analysis.substring(0, 100);
          greeting += `   ${summary}...\n`;
        }
        
        if (report.metrics && Object.keys(report.metrics).length > 0) {
          const metricKeys = Object.keys(report.metrics).slice(0, 2);
          greeting += `   Key metrics: ${metricKeys.join(', ')}\n`;
        }
        greeting += '\n';
      });
      
      greeting += `I have a complete understanding of your health profile. Feel free to ask me about your reports, health concerns, or get personalized recommendations!\n\nWhat would you like to know?`;
    } else {
      greeting += `I can help you understand your health reports, explain medical terms, provide diet guidance, and answer health-related questions. What would you like to know?`;
    }
    
    return greeting;
  };

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
      if (index <= text.length) {
        setStreamingText(text.substring(0, index));
        index++;
      } else {
        clearInterval(interval);
        setStreaming(false);
        callback();
      }
    }, 15); // Adjust speed here (lower = faster)
    
    return () => clearInterval(interval);
  };

  const clearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      try {
        // Clear from localStorage
        localStorage.removeItem(`chat_history_${user?.id}_${currentSessionId}`);
        
        const greeting = generateGreetingWithReports();
        setMessages([
          {
            role: 'assistant',
            content: greeting,
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

  const startNewSession = () => {
    const newSessionId = `session_${Date.now()}`;
    setCurrentSessionId(newSessionId);
    const greeting = generateGreetingWithReports();
    setMessages([
      {
        role: 'assistant',
        content: greeting,
        timestamp: new Date()
      }
    ]);
    setSidebarOpen(false);
    toast.success('New chat started');
  };

  const loadChatSession = (sessionId) => {
    try {
      const savedMessages = localStorage.getItem(`chat_history_${user?.id}_${sessionId}`);
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        setMessages(parsedMessages);
        setCurrentSessionId(sessionId);
        setSidebarOpen(false);
      }
    } catch (error) {
      console.error('Failed to load session:', error);
      toast.error('Failed to load chat session');
    }
  };

  // Save message to localStorage
  const saveMessageToDb = async (userQuery, aiResponse) => {
    try {
      // Save to localStorage for persistence
      const updatedMessages = [
        ...messages,
        { role: 'user', content: userQuery, timestamp: new Date() },
        { role: 'assistant', content: aiResponse, timestamp: new Date() }
      ];
      localStorage.setItem(`chat_history_${user?.id}_${currentSessionId}`, JSON.stringify(updatedMessages));
      
      // Update chat sessions list
      const sessionTitle = userQuery.substring(0, 30) + (userQuery.length > 30 ? '...' : '');
      const existingSession = chatSessions.find(s => s.id === currentSessionId);
      
      if (!existingSession) {
        const newSession = {
          id: currentSessionId,
          title: sessionTitle,
          date: new Date().toISOString(),
          preview: userQuery.substring(0, 50)
        };
        const updatedSessions = [newSession, ...chatSessions];
        setChatSessions(updatedSessions);
        localStorage.setItem(`chat_sessions_${user?.id}`, JSON.stringify(updatedSessions));
      }
    } catch (error) {
      console.error('Failed to save chat history:', error);
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
      // Call the chat API endpoint
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          query: currentInput,
          conversationHistory: messages.slice(-10), // Send last 10 messages for context
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
        throw new Error(errorData.message || `Failed to get AI response (${response.status})`);
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
          
          // Save to localStorage
          const updatedMessages = [...messages, userMessage, aiResponse];
          localStorage.setItem(`chat_history_${user?.id}_${currentSessionId}`, JSON.stringify(updatedMessages));
          
          // Update sessions
          const sessionTitle = currentInput.substring(0, 30) + (currentInput.length > 30 ? '...' : '');
          const existingSession = chatSessions.find(s => s.id === currentSessionId);
          if (!existingSession) {
            const newSession = {
              id: currentSessionId,
              title: sessionTitle,
              date: new Date().toISOString(),
              preview: currentInput.substring(0, 50)
            };
            const updatedSessions = [newSession, ...chatSessions];
            setChatSessions(updatedSessions);
            localStorage.setItem(`chat_sessions_${user?.id}`, JSON.stringify(updatedSessions));
          }
        });
      } else {
        throw new Error('Invalid response from AI');
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      toast.error('Failed to get response. Using fallback.');
      
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
        
        // Save to localStorage
        const updatedMessages = [...messages, userMessage, aiResponse];
        localStorage.setItem(`chat_history_${user?.id}_${currentSessionId}`, JSON.stringify(updatedMessages));
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
    <div className="h-screen flex" style={{ backgroundColor: '#F5F1EA' }}>
      {/* Sidebar */}
      <div className={`fixed md:relative w-64 h-screen bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-50 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Sidebar Header */}
        <div className="p-4 border-b border-gray-200 flex items-center justify-between">
          <h2 className="font-bold text-gray-900">Chat History</h2>
          <button
            onClick={() => setSidebarOpen(false)}
            className="md:hidden p-1 hover:bg-gray-100 rounded"
          >
            <XIcon className="w-5 h-5" />
          </button>
        </div>

        {/* New Chat Button */}
        <button
          onClick={startNewSession}
          className="m-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium"
        >
          <MessageSquare className="w-4 h-4" />
          New Chat
        </button>

        {/* Chat Sessions */}
        <div className="flex-1 overflow-y-auto px-3 space-y-2">
          {chatSessions.length > 0 ? (
            chatSessions.map((session) => (
              <button
                key={session.id}
                onClick={() => loadChatSession(session.id)}
                className={`w-full text-left p-3 rounded-lg transition ${
                  currentSessionId === session.id
                    ? 'bg-blue-100 border-l-4 border-blue-600'
                    : 'hover:bg-gray-100'
                }`}
              >
                <p className="text-sm font-medium text-gray-900 truncate">{session.title}</p>
                <p className="text-xs text-gray-500 truncate mt-1">{session.preview}</p>
                <p className="text-xs text-gray-400 mt-1">
                  {new Date(session.date).toLocaleDateString()}
                </p>
              </button>
            ))
          ) : (
            <p className="text-sm text-gray-500 text-center py-8">No chat history yet</p>
          )}
        </div>

        {/* Sidebar Footer */}
        <div className="p-3 border-t border-gray-200 space-y-2">
          <button
            onClick={clearChat}
            className="w-full px-3 py-2 text-sm text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-2"
          >
            <Trash2 className="w-4 h-4" />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col">
        {/* Header with Menu Button */}
        <div className="md:hidden flex items-center justify-between px-4 py-3 border-b border-gray-200 bg-white">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-2 hover:bg-gray-100 rounded"
          >
            <Menu className="w-5 h-5" />
          </button>
          <h1 className="font-bold text-gray-900">AI Assistant</h1>
          <div className="w-8" />
        </div>

        {/* Messages */}
        <div 
          ref={chatContainerRef}
          className="flex-1 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-4 pb-32 md:pb-28"
          style={{ userSelect: 'text' }}
          onMouseUp={(e) => {
            e.stopPropagation();
          }}
        >
          {messages.map((message, index) => (
            <div
              key={index}
              className={`flex gap-3 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              {message.role === 'assistant' && (
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: '#8B7355' }}>
                  <Bot className="w-5 h-5 text-white" />
                </div>
              )}
              
              <div
                className={`max-w-[80%] sm:max-w-[70%] rounded-2xl px-4 py-3 shadow-sm ${
                  message.role === 'user'
                    ? 'text-white shadow-sm'
                    : 'bg-white text-slate-800'
                }`}
                style={message.role === 'user' ? { 
                  backgroundColor: '#8B7355',
                  border: '1px solid #E5DFD3'
                } : {
                  border: '1px solid #E5DFD3'
                }}
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
                      className="transition-colors p-1 rounded"
                      style={{ color: '#5C4F3D' }}
                      onMouseEnter={(e) => {
                        e.currentTarget.style.color = '#8B7355';
                        e.currentTarget.style.backgroundColor = '#F5F1EA';
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.color = '#5C4F3D';
                        e.currentTarget.style.backgroundColor = 'transparent';
                      }}
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
                <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-sm" style={{ backgroundColor: '#E5DFD3' }}>
                  <User className="w-5 h-5" style={{ color: '#5C4F3D' }} />
                </div>
              )}
            </div>
          ))}

          {/* Streaming message */}
          {streaming && streamingText && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: '#8B7355' }}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="max-w-[80%] sm:max-w-[70%] bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ border: '1px solid #E5DFD3' }}>
                <div className="whitespace-pre-wrap break-words text-sm sm:text-base leading-relaxed" style={{ color: '#2C2416' }}>
                  {streamingText}
                  <span className="inline-block w-1 h-4 ml-1 animate-pulse" style={{ backgroundColor: '#8B7355' }}></span>
                </div>
              </div>
            </div>
          )}

          {/* Loading indicator */}
          {loading && !streaming && (
            <div className="flex gap-3 justify-start">
              <div className="w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-md" style={{ backgroundColor: '#8B7355' }}>
                <Bot className="w-5 h-5 text-white" />
              </div>
              <div className="bg-white rounded-2xl px-4 py-3 shadow-sm" style={{ border: '1px solid #E5DFD3' }}>
                <div className="flex items-center gap-2" style={{ color: '#5C4F3D' }}>
                  <Loader2 className="w-4 h-4 animate-spin" style={{ color: '#8B7355' }} />
                  <span className="text-sm">Analyzing your question...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - Sticky at bottom */}
        <div className="fixed bottom-20 md:bottom-0 left-0 right-0 md:left-64 flex justify-center items-center px-3 md:px-6 py-3 md:py-4" style={{ backgroundColor: '#F5F1EA', zIndex: 40 }}>
          <form onSubmit={handleSubmit} className="w-full md:max-w-2xl flex gap-2 md:gap-3 items-end">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                placeholder="Ask about your health..."
                className="w-full px-4 py-2.5 md:py-3 pr-10 bg-white rounded-full focus:outline-none focus:ring-2 transition-all text-sm md:text-base shadow-md hover:shadow-lg"
                style={{ 
                  border: '1.5px solid #E5DFD3',
                  color: '#2C2416'
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = '#8B7355';
                  e.target.style.boxShadow = '0 4px 16px rgba(139, 115, 85, 0.2)';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = '#E5DFD3';
                  e.target.style.boxShadow = '0 2px 8px rgba(0, 0, 0, 0.08)';
                }}
                disabled={loading || streaming}
              />
              {input && (
                <button
                  type="button"
                  onClick={() => setInput('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-lg hover:opacity-70 transition-opacity"
                  style={{ color: '#5C4F3D' }}
                >
                  ×
                </button>
              )}
            </div>
            <button
              type="submit"
              disabled={!input.trim() || loading || streaming}
              className="px-4 md:px-5 py-2.5 md:py-3 text-white rounded-full font-medium hover:shadow-lg hover:scale-105 transition-all disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100 flex items-center gap-1 md:gap-2 flex-shrink-0 text-sm md:text-base shadow-md"
              style={{ backgroundColor: '#8B7355' }}
              title={!input.trim() ? 'Type a message first' : 'Send message'}
            >
              {loading || streaming ? (
                <Loader2 className="w-4 md:w-5 h-4 md:h-5 animate-spin" />
              ) : (
                <>
                  <Send className="w-4 md:w-5 h-4 md:h-5" />
                  <span className="hidden sm:inline">Send</span>
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
