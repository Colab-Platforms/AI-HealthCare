import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Bot, User, Loader2, Copy, Check, Trash2, Menu, X, Bell, Sparkles, ArrowLeft, MoreVertical, MessageSquare, ShieldCheck, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

// Clean up AI response: remove markdown bold, excessive special chars, and format as clean text
function formatResponse(text) {
  if (!text) return text;
  let cleaned = text;
  // Remove markdown bold (**text** or __text__)
  cleaned = cleaned.replace(/\*\*([^*]+)\*\*/g, '$1');
  cleaned = cleaned.replace(/__([^_]+)__/g, '$1');
  // Remove markdown italic (*text* or _text_) but keep bullet points
  cleaned = cleaned.replace(/(?<!\n)\*([^*\n]+)\*/g, '$1');
  // Remove markdown headers (### text)
  cleaned = cleaned.replace(/^#{1,6}\s+/gm, '');
  // Convert markdown bullet points (- item or * item) to clean bullet
  cleaned = cleaned.replace(/^[\-\*]\s+/gm, '• ');
  // Remove excessive exclamation marks (!! or more)
  cleaned = cleaned.replace(/!{2,}/g, '.');
  // Remove stray special characters that look like jargon (multiple consecutive special chars)
  cleaned = cleaned.replace(/[!@#$%^&]{2,}/g, '');
  // Clean up multiple newlines into max 2
  cleaned = cleaned.replace(/\n{3,}/g, '\n\n');
  return cleaned.trim();
}

export default function AIChat() {
  const { user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
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
        const { data } = await api.get('health/reports');
        setUserReports(data.reports || data || []);
      } catch (error) {
        console.error('Failed to load reports:', error);
      }
    };
    fetchUserReports();
  }, []);

  useEffect(() => {
    const loadChatHistory = async () => {
      try {
        const { data } = await api.get('chat/history');
        if (data.success && data.messages && data.messages.length > 0) {
          setMessages(data.messages);
          localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(data.messages));
          return;
        }
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}`);
        if (savedMessages) {
          setMessages(JSON.parse(savedMessages));
        } else {
          const greeting = generateGreetingWithReports();
          setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
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

    if (location.state?.initialQuery) {
      setInput(location.state.initialQuery);
      setTimeout(() => {
        const form = document.querySelector('form');
        if (form) form.requestSubmit();
      }, 500);
    }
  }, [user?.id, location.state, user?.name]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingText]);

  const generateGreetingWithReports = () => {
    let greeting = `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm your take.health Coach.\n\n`;
    if (userReports && userReports.length > 0) {
      greeting += `I've analyzed your health profile and recent reports. How can I assist you today with your wellness journey?`;
    } else {
      greeting += `I can help you analyze medical reports, plan your nutrition, or answer any health-related questions. What's on your mind?`;
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
    }, 10);
    return () => clearInterval(interval);
  };

  const saveChatToBackend = async (updatedMessages) => {
    try {
      const newMessages = updatedMessages.slice(-2);
      await api.post('chat/history', { messages: newMessages });
      localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(updatedMessages));
    } catch (error) {
      localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(updatedMessages));
    }
  };

  const clearChat = async () => {
    if (confirm('Are you sure you want to clear your conversation history?')) {
      try {
        await api.delete('chat/history');
        localStorage.removeItem(`chat_history_${user?.id}`);
        const greeting = generateGreetingWithReports();
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        toast.success('Conversation history wiped');
      } catch (error) {
        localStorage.removeItem(`chat_history_${user?.id}`);
        const greeting = generateGreetingWithReports();
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
      }
    }
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
      const { data } = await api.post('chat', {
        query: currentInput,
        conversationHistory: messages.slice(-10),
        userReports: userReports.map(r => ({
          type: r.reportType,
          date: r.uploadDate,
          analysis: r.analysis,
          metrics: r.metrics
        }))
      });

      if (data.success && data.response) {
        const cleanedResponse = formatResponse(data.response);
        streamResponse(cleanedResponse, () => {
          const aiResponse = { role: 'assistant', content: cleanedResponse, timestamp: new Date() };
          const updatedMessages = [...messages, userMessage, aiResponse];
          setMessages(updatedMessages);
          setStreamingText('');
          saveChatToBackend(updatedMessages);
        });
      }
    } catch (error) {
      console.error('AI Chat error:', error);
      toast.error('Connection lost. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text, index) => {
    navigator.clipboard.writeText(text);
    setCopiedIndex(index);
    setTimeout(() => setCopiedIndex(null), 2000);
    toast.success('Copied to clipboard');
  };

  return (
    <div className="w-full bg-white flex flex-col md:flex-row md:pb-0" style={{ position: 'relative', height: '100%', minHeight: 0 }}>
      {/* Sidebar - Desktop */}
      <div className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-50 border-r border-slate-100 flex flex-col z-[60] transition-transform duration-500 ease-in-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
              <History className="w-5 h-5 text-white" />
            </div>
            <h2 className="font-black text-black uppercase tracking-tighter">History</h2>
          </div>
          <button onClick={() => setSidebarOpen(false)} className="md:hidden p-2 hover:bg-slate-100 rounded-full transition-colors">
            <X className="w-5 h-5 text-slate-400" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          <button
            onClick={() => { setMessages([{ role: 'assistant', content: generateGreetingWithReports(), timestamp: new Date() }]); setSidebarOpen(false); }}
            className="w-full p-4 bg-black text-white rounded-2xl border border-black font-black uppercase text-[10px] tracking-widest hover:bg-slate-900 transition-all flex items-center justify-center gap-2"
          >
            + New Session
          </button>

          <div className="pt-4 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recent Sessions</p>
            <div className="p-4 bg-white rounded-2xl border border-slate-100 text-[11px] font-bold text-slate-500 italic">
              All health insights are encrypted & private.
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-slate-100 bg-white">
          <button onClick={clearChat} className="w-full p-4 flex items-center justify-center gap-2 text-rose-500 hover:bg-rose-50 rounded-2xl transition-all font-black uppercase text-[10px] tracking-widest">
            <Trash2 className="w-4 h-4" /> Clear All Data
          </button>
        </div>
      </div>

      {sidebarOpen && <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-50 md:hidden" onClick={() => setSidebarOpen(false)} />}

      {/* Main Chat Interface - uses fixed input on mobile */}
      <div className="flex-1 flex flex-col relative bg-transparent" style={{ height: '100%', minHeight: 0 }}>

        {/* Message Viewport - scrollable, with bottom padding for the fixed input dock */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 pt-4 pb-44 md:pb-8 space-y-8 scroll-smooth" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`flex gap-3 md:gap-4 w-full md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border border-slate-200 bg-white">
                    <Sparkles className="w-4 h-4 text-emerald-600" />
                  </div>
                )}
                <div className={`relative w-full md:w-auto flex flex-col ${msg.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-3xl px-5 py-3.5' : 'bg-transparent text-slate-800 py-1'}`}>
                  <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap max-w-none">
                    {msg.content}
                  </div>
                  <div className={`flex items-center mt-2 gap-4 ${msg.role === 'user' ? 'justify-end hidden' : 'justify-start text-slate-400'}`}>
                    {msg.role === 'assistant' && (
                      <button onClick={() => copyToClipboard(msg.content, i)} className="p-1 hover:bg-slate-100 rounded transition-colors flex items-center justify-center">
                        {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-black" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(streamingText || loading) && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="flex gap-3 md:gap-4 w-full md:max-w-[75%]">
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border border-slate-200 bg-white">
                  <Sparkles className="w-4 h-4 text-emerald-600" />
                </div>
                <div className="relative w-full md:w-auto flex flex-col bg-transparent text-slate-800 py-1 min-w-[120px]">
                  {streamingText ? (
                    <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap flex items-center">
                      {streamingText}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-black animate-pulse"></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3 h-full">
                      <Loader2 className="w-4 h-4 animate-spin text-black" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Synthesizing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} />
        </div>

        {/* Input Dock - FIXED at the bottom of viewport on mobile, flex-end on desktop */}
        <div className="fixed bottom-0 left-0 right-0 md:relative md:bottom-auto px-4 md:px-6 py-4 md:py-6 bg-white border-t border-slate-100 z-40">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="relative bg-white border border-slate-200 focus-within:border-slate-300 rounded-[2rem] p-2 flex items-center gap-3 transition-all shadow-lg shadow-black/[0.03]">
                <div className="hidden sm:flex w-10 h-10 items-center justify-center text-slate-300">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your health reports..."
                  disabled={loading || streaming}
                  className="flex-1 bg-transparent py-3 px-2 text-sm font-bold text-black focus:outline-none focus:ring-0 placeholder:text-slate-400 placeholder:font-black placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest border-none"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading || streaming}
                  className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all shadow-black/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
            <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mt-3">
              Protected by medical-grade encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
