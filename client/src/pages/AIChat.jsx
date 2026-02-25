import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'react-router-dom';
import { Send, Bot, User, Loader2, Copy, Check, Trash2, Menu, X, Bell } from 'lucide-react';
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
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  useEffect(() => {
    const fetchUserReports = async () => {
      try {
        const token = localStorage.getItem('token');
        const response = await fetch('/api/health/reports', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (response.ok) {
          const data = await response.json();
          setUserReports(data.reports || []);
        }
      } catch (error) {
        console.error('Failed to load reports:', error);
      }
    };
    fetchUserReports();
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        // First try to load from backend
        const token = localStorage.getItem('token');
        const response = await fetch('/api/chat/history', {
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        if (response.ok) {
          const data = await response.json();
          if (data.success && data.messages && data.messages.length > 0) {
            setMessages(data.messages);
            // Also save to localStorage as backup
            localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(data.messages));
            return;
          }
        }
        
        // Fallback to localStorage if backend fails
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}`);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          setMessages(parsed);
        } else {
          // Show greeting if no history
          const greeting = generateGreetingWithReports();
          setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        // Fallback to localStorage
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}`);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          const greeting = generateGreetingWithReports();
          setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        }
      }
    };
    
    if (user) loadChatHistory();
    
    // Handle incoming query from Ask Coach
    if (location.state?.initialQuery) {
      setInput(location.state.initialQuery);
      // Auto-submit the query
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }, 500);
    } else if (location.state?.selectedText) {
      setInput(`Can you explain this: "${location.state.selectedText}"`);
    }
  }, [user?.id, location.state, user?.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const generateGreetingWithReports = () => {
    let greeting = `Hello ${user?.name || 'there'}! 👋 I'm your AI health assistant.\n\n`;
    if (userReports && userReports.length > 0) {
      greeting += `I've reviewed your uploaded health reports:\n\n`;
      userReports.slice(0, 3).forEach((report) => {
        const date = new Date(report.uploadDate).toLocaleDateString();
        greeting += `📋 **${report.reportType}** (${date})\n`;
        if (report.analysis) {
          greeting += `   ${report.analysis.substring(0, 100)}...\n`;
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
    }, 15);
    return () => clearInterval(interval);
  };

  const saveChatToBackend = async (updatedMessages) => {
    try {
      const token = localStorage.getItem('token');
      // Save only new messages (last 2: user + assistant)
      const newMessages = updatedMessages.slice(-2);
      
      await fetch('/api/chat/history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({ messages: newMessages })
      });
      
      // Also save to localStorage as backup
      localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(updatedMessages));
    } catch (error) {
      console.error('Failed to save chat to backend:', error);
      // Still save to localStorage
      localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(updatedMessages));
    }
  };

  const clearChat = async () => {
    if (confirm('Are you sure you want to clear the chat history?')) {
      try {
        const token = localStorage.getItem('token');
        // Clear from backend
        await fetch('/api/chat/history', {
          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        
        // Clear from localStorage
        localStorage.removeItem(`chat_history_${user?.id}`);
        
        const greeting = generateGreetingWithReports();
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        toast.success('Chat cleared');
      } catch (error) {
        console.error('Failed to clear chat:', error);
        // Still clear localStorage
        localStorage.removeItem(`chat_history_${user?.id}`);
        const greeting = generateGreetingWithReports();
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        toast.error('Chat cleared locally');
      }
    }
  };

  const startNewSession = () => {
    const greeting = generateGreetingWithReports();
    setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
    setSidebarOpen(false);
    toast.success('New chat started');
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = { role: 'user', content: input, timestamp: new Date() };
    setMessages(prev => [...prev, userMessage]);
    const currentInput = input;
    setInput('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: currentInput,
          conversationHistory: messages.slice(-10),
          userReports: userReports.map(r => ({
            type: r.reportType,
            date: r.uploadDate,
            analysis: r.analysis,
            metrics: r.metrics
          }))
        })
      });

      if (!response.ok) throw new Error('Failed to get AI response');
      const data = await response.json();
      
      if (data.success && data.response) {
        streamResponse(data.response, () => {
          const aiResponse = { role: 'assistant', content: data.response, timestamp: new Date() };
          const updatedMessages = [...messages, userMessage, aiResponse];
          setMessages(updatedMessages);
          setStreamingText('');
          
          // Save to backend and localStorage
          saveChatToBackend(updatedMessages);
        });
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      toast.error('Failed to get response');
      const fallbackResponse = generateAIResponse(currentInput);
      streamResponse(fallbackResponse, () => {
        const aiResponse = { role: 'assistant', content: fallbackResponse, timestamp: new Date() };
        const updatedMessages = [...messages, userMessage, aiResponse];
        setMessages(updatedMessages);
        setStreamingText('');
        
        // Save to backend and localStorage
        saveChatToBackend(updatedMessages);
      });
    } finally {
      setLoading(false);
    }
  };

  const generateAIResponse = (query) => {
    const lowerQuery = query.toLowerCase();
    if (lowerQuery.includes('vitamin d')) {
      return `Based on your query about Vitamin D:\n\n**What is Vitamin D?**\nVitamin D is essential for bone health, immune function, and overall wellbeing.\n\n**Normal Range:** 30-100 ng/mL\n\n**If Low:**\n• Get 15-20 minutes of morning sunlight daily\n• Eat fish, eggs, fortified milk\n• Consider supplements (consult your doctor)`;
    }
    if (lowerQuery.includes('iron') || lowerQuery.includes('hemoglobin')) {
      return `Regarding Iron and Hemoglobin:\n\n**Importance:**\nIron is crucial for producing hemoglobin, which carries oxygen in your blood.\n\n**Normal Hemoglobin:** 12-17 g/dL\n**Normal Iron:** 60-170 mcg/dL\n\n**To Increase Iron:**\n• Red meat, spinach, dal\n• Eat with Vitamin C foods\n• Avoid tea/coffee with meals`;
    }
    return `Thank you for your question. I'm here to help with understanding your health reports, explaining medical terms, providing diet guidance, and answering health-related questions.`;
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="w-full h-full bg-white flex flex-col md:flex-row">
      {/* Welcome Message - Mobile Only - Fixed at top */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-30 bg-white border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <div className="w-9 h-9 rounded-full bg-gradient-to-br from-purple-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-md flex-shrink-0">
            {user?.name?.[0]?.toUpperCase() || 'U'}
          </div>
          <h1 className="text-sm font-bold text-slate-800 truncate">
            {(() => {
              const hour = new Date().getHours();
              if (hour < 12) return 'Good Morning';
              if (hour < 18) return 'Good Afternoon';
              return 'Good Evening';
            })()}, {user?.name?.split(' ')[0] || 'there'}!
          </h1>
        </div>
        <button className="w-8 h-8 rounded-full bg-white shadow-md flex items-center justify-center hover:shadow-lg transition-all border border-gray-200 flex-shrink-0">
          <Bell className="w-4 h-4 text-slate-700" />
        </button>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/30 z-40 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar - Hidden on mobile by default, visible on desktop */}
      <div className={`fixed md:static left-0 top-0 h-full w-64 bg-white border-r border-gray-200 flex flex-col transition-transform duration-300 z-50 md:z-auto ${sidebarOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'} md:translate-x-0 shrink-0`}>
        <div className="p-3 border-b border-gray-200 flex items-center justify-between shrink-0">
          <h2 className="font-bold text-gray-900 text-xs">Chat History</h2>
          <button onClick={() => setSidebarOpen(false)} className="p-1 hover:bg-gray-100 rounded md:hidden">
            <X className="w-4 h-4" />
          </button>
        </div>

        <button onClick={startNewSession} className="m-2 px-3 py-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition flex items-center justify-center gap-2 font-medium text-xs shrink-0">
          + New Chat
        </button>

        <div className="flex-1 overflow-y-auto px-2 space-y-1">
          <div className="p-3 text-center">
            <p className="text-xs text-gray-500">Chat history is saved automatically</p>
            <p className="text-xs text-gray-400 mt-1">{messages.length} messages in current chat</p>
          </div>
        </div>

        <div className="p-2 border-t border-gray-200 space-y-1 shrink-0">
          <button onClick={clearChat} className="w-full px-2 py-1.5 text-xs text-red-600 hover:bg-red-50 rounded-lg transition flex items-center justify-center gap-2">
            <Trash2 className="w-3 h-3" />
            Clear Chat
          </button>
        </div>
      </div>

      {/* Main Chat Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top Bar - with padding for mobile welcome message */}
        <div className="flex items-center px-3 py-2 border-b border-gray-200 bg-white shrink-0 mt-16 md:mt-0">
          <button onClick={() => setSidebarOpen(!sidebarOpen)} className="p-1.5 hover:bg-gray-100 rounded-lg transition md:hidden" title="Toggle chat history">
            <Menu className="w-5 h-5 text-gray-700" />
          </button>
        </div>

        {/* Messages - with padding for mobile input */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-3 py-4 space-y-3 pb-24 md:pb-4" style={{ userSelect: 'text' }}>
          {messages.map((message, index) => (
            <div key={index} className={`flex gap-2 ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              {message.role === 'assistant' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-600">
                  <Bot className="w-4 h-4 text-white" />
                </div>
              )}
              <div className={`max-w-xs md:max-w-md rounded-2xl px-3 py-2 ${message.role === 'user' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-900'}`}>
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed">{message.content}</div>
                <div className="flex items-center justify-between mt-1 gap-2">
                  <span className={`text-xs ${message.role === 'user' ? 'text-blue-100' : 'text-gray-500'}`}>
                    {message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </span>
                  {message.role === 'assistant' && (
                    <button onClick={() => copyToClipboard(message.content, index)} className="transition-colors p-0.5 rounded hover:bg-gray-200" title="Copy response">
                      {copiedIndex === index ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3 text-gray-500" />}
                    </button>
                  )}
                </div>
              </div>
              {message.role === 'user' && (
                <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-gray-300">
                  <User className="w-4 h-4 text-gray-700" />
                </div>
              )}
            </div>
          ))}

          {streaming && streamingText && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-600">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="max-w-xs md:max-w-md bg-gray-100 rounded-2xl px-3 py-2">
                <div className="whitespace-pre-wrap break-words text-sm leading-relaxed text-gray-900">
                  {streamingText}
                  <span className="inline-block w-1 h-3 ml-1 animate-pulse bg-blue-600"></span>
                </div>
              </div>
            </div>
          )}

          {loading && !streaming && (
            <div className="flex gap-2 justify-start">
              <div className="w-7 h-7 rounded-full flex items-center justify-center shrink-0 bg-blue-600">
                <Bot className="w-4 h-4 text-white" />
              </div>
              <div className="bg-gray-100 rounded-2xl px-3 py-2">
                <div className="flex items-center gap-2 text-gray-700">
                  <Loader2 className="w-3 h-3 animate-spin text-blue-600" />
                  <span className="text-xs">Analyzing...</span>
                </div>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input - Fixed at bottom on mobile, relative on desktop */}
        <div className="fixed md:relative bottom-0 left-0 right-0 md:bottom-auto border-t border-gray-200 bg-white p-3 shrink-0 md:w-auto">
          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <input type="text" value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask..." className="w-full px-3 py-2.5 bg-gray-50 rounded-2xl focus:outline-none transition-all text-sm border border-gray-200 focus:border-blue-500 focus:bg-white" disabled={loading || streaming} />
              {input && (
                <button type="button" onClick={() => setInput('')} className="absolute right-2 top-1/2 -translate-y-1/2 text-lg hover:opacity-70 transition-opacity text-gray-500">
                  ×
                </button>
              )}
            </div>
            <button type="submit" disabled={!input.trim() || loading || streaming} className="px-3 py-2.5 text-white rounded-2xl font-medium hover:shadow-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1 flex-shrink-0 bg-blue-600 hover:bg-blue-700" title={!input.trim() ? 'Type a message first' : 'Send message'}>
              {loading || streaming ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
