import { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Bot, User, Loader2, Copy, Check, Trash2, Menu, X, Bell, Sparkles, ArrowLeft, MoreVertical, MessageSquare, ShieldCheck, History } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import api from '../services/api';
import toast from 'react-hot-toast';

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
    let greeting = `Hello ${user?.name?.split(' ')[0] || 'there'}! I'm your **FitCure Intelligence** assistant. 👋\n\n`;
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
        streamResponse(data.response, () => {
          const aiResponse = { role: 'assistant', content: data.response, timestamp: new Date() };
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
    <div className="fixed inset-0 bg-white flex flex-col md:flex-row overflow-hidden pb-[90px] md:pb-0">
      {/* Sidebar - Desktop */}
      <div className={`fixed md:relative inset-y-0 left-0 w-80 bg-slate-50 border-r border-slate-100 flex flex-col z-[60] transition-transform duration-500 ease-in-out md:translate-x-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-lg shadow-black/10">
              <History className="w-5 h-5 text-[#2FC8B9]" />
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
            className="w-full p-4 bg-[#2FC8B9]/10 text-[#2FC8B9] rounded-2xl border border-[#2FC8B9]/20 font-black uppercase text-[10px] tracking-widest hover:bg-[#2FC8B9]/20 transition-all flex items-center justify-center gap-2"
          >
            + New Session
          </button>

          <div className="pt-4 px-2">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recent Sessions</p>
            {/* Placeholder for real session history if implemented */}
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

      {/* Main Chat Interface */}
      <div className="flex-1 flex flex-col h-full relative bg-white">
        {/* Header */}
        <header className="h-[72px] bg-white/80 backdrop-blur-md border-b border-slate-100 flex items-center justify-between px-6 sticky top-0 z-40">
          <div className="flex items-center gap-4">
            <button onClick={() => setSidebarOpen(true)} className="md:hidden p-2 hover:bg-slate-50 rounded-xl transition-colors">
              <Menu className="w-6 h-6 text-black" />
            </button>
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 bg-black rounded-xl flex items-center justify-center shadow-xl shadow-black/10">
                <Sparkles className="w-5 h-5 text-[#2FC8B9]" />
              </div>
              <div>
                <h1 className="text-sm font-black text-black uppercase tracking-tighter leading-none">FitCure AI</h1>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Active Intelligence</span>
                </div>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button className="hidden sm:flex items-center gap-2 px-4 py-2 bg-slate-50 rounded-xl border border-slate-100 text-[10px] font-black uppercase tracking-widest text-slate-600">
              <ShieldCheck className="w-4 h-4 text-emerald-500" /> Secure
            </button>
            <button onClick={() => navigate(-1)} className="p-2.5 hover:bg-slate-50 rounded-xl transition-colors">
              <ArrowLeft className="w-5 h-5 text-black" />
            </button>
          </div>
        </header>

        {/* Message Viewport */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 py-8 space-y-8 scroll-smooth">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`flex gap-4 max-w-[85%] md:max-w-[70%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                <div className={`w-10 h-10 rounded-xl shrink-0 flex items-center justify-center shadow-lg ${msg.role === 'user' ? 'bg-[#2FC8B9]' : 'bg-black'}`}>
                  {msg.role === 'user' ? <User className="w-5 h-5 text-white" /> : <Bot className="w-5 h-5 text-[#2FC8B9]" />}
                </div>
                <div className={`relative p-5 rounded-2xl shadow-sm ${msg.role === 'user' ? 'bg-[#2FC8B9] text-white rounded-tr-none' : 'bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none'}`}>
                  <div className="text-sm leading-relaxed font-bold prose prose-slate max-w-none prose-sm">
                    {msg.content}
                  </div>
                  <div className={`flex items-center justify-between mt-4 gap-4 ${msg.role === 'user' ? 'text-white/60' : 'text-slate-400'}`}>
                    <span className="text-[10px] font-black uppercase tracking-widest">
                      {new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                    {msg.role === 'assistant' && (
                      <button onClick={() => copyToClipboard(msg.content, i)} className="p-1 hover:bg-slate-200 rounded-lg transition-colors">
                        {copiedIndex === i ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}

          {(streamingText || loading) && (
            <div className="flex justify-start animate-in fade-in duration-300">
              <div className="flex gap-4 max-w-[85%] md:max-w-[70%]">
                <div className="w-10 h-10 bg-black rounded-xl shrink-0 flex items-center justify-center shadow-lg">
                  <Bot className="w-5 h-5 text-[#2FC8B9]" />
                </div>
                <div className="p-5 rounded-2xl bg-slate-50 text-slate-800 border border-slate-100 rounded-tl-none shadow-sm min-w-[120px]">
                  {streamingText ? (
                    <div className="text-sm leading-relaxed font-bold whitespace-pre-wrap">
                      {streamingText}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-[#2FC8B9] animate-pulse"></span>
                    </div>
                  ) : (
                    <div className="flex items-center gap-3">
                      <Loader2 className="w-4 h-4 animate-spin text-[#2FC8B9]" />
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Synthesizing...</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
          <div ref={messagesEndRef} className="h-4" />
        </div>

        {/* Input Dock - Modern floating style with safe padding */}
        <div className="px-6 py-6 bg-gradient-to-t from-white via-white to-white/0 sticky bottom-0 z-40">
          <div className="max-w-4xl mx-auto">
            <form onSubmit={handleSubmit} className="relative group">
              <div className="absolute inset-0 bg-black rounded-[2rem] blur-[20px] opacity-[0.03] group-focus-within:opacity-[0.08] transition-opacity"></div>
              <div className="relative bg-white border-2 border-slate-100 group-focus-within:border-[#2FC8B9] rounded-[2rem] p-2 flex items-center gap-3 transition-all shadow-xl shadow-black/[0.02]">
                <div className="hidden sm:flex w-10 h-10 items-center justify-center text-slate-300">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your health reports..."
                  disabled={loading || streaming}
                  className="flex-1 bg-transparent py-3 px-2 text-sm font-bold text-black focus:outline-none placeholder:text-slate-400 placeholder:font-black placeholder:uppercase placeholder:text-[10px] placeholder:tracking-widest"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || loading || streaming}
                  className="w-12 h-12 bg-black text-[#2FC8B9] rounded-full flex items-center justify-center shadow-xl hover:scale-105 active:scale-95 disabled:opacity-30 disabled:scale-100 transition-all shadow-black/20"
                >
                  {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <Send className="w-5 h-5" />}
                </button>
              </div>
            </form>
            <p className="text-center text-[9px] font-black text-slate-400 uppercase tracking-widest mt-4">
              Protected by medical-grade encryption
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
