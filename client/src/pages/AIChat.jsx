import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useLocation, useNavigate } from 'react-router-dom';
import { Send, Bot, User, Loader2, Copy, Check, Trash2, Menu, X, Bell, Sparkles, ArrowLeft, MoreVertical, MessageSquare, ShieldCheck, History, Activity, ChevronRight, TrendingUp, Zap } from 'lucide-react';
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
  const [searchHistory, setSearchHistory] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [streaming, setStreaming] = useState(false);
  const [streamingText, setStreamingText] = useState('');
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [userReports, setUserReports] = useState([]);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [loaderMessageIndex, setLoaderMessageIndex] = useState(0);
  const messagesEndRef = useRef(null);
  const chatContainerRef = useRef(null);

  const isDiabetic = user?.profile?.isDiabetic === 'yes' || 
    user?.profile?.medicalHistory?.conditions?.some(c => c.toLowerCase().includes('diabet'));

  // Rotate loader messages during analysis
  useEffect(() => {
    let interval;
    if (loading) {
      interval = setInterval(() => {
        setLoaderMessageIndex(prev => (prev + 1) % 3);
      }, 2000);
    }
    return () => clearInterval(interval);
  }, [loading]);


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
          setSearchHistory(data.messages);
          localStorage.setItem(`chat_history_${user?.id}`, JSON.stringify(data.messages));
          return;
        }
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}`);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          setMessages(parsed);
          setSearchHistory(parsed);
        } else {
          const greeting = generateGreetingWithReports();
          setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        }
      } catch (error) {
        console.error('Failed to load chat history:', error);
        const savedMessages = localStorage.getItem(`chat_history_${user?.id}`);
        if (savedMessages) {
          const parsed = JSON.parse(savedMessages);
          setMessages(parsed);
          setSearchHistory(parsed);
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
        setSearchHistory([]);
        toast.success('Conversation history wiped');
      } catch (error) {
        localStorage.removeItem(`chat_history_${user?.id}`);
        const greeting = generateGreetingWithReports();
        setMessages([{ role: 'assistant', content: greeting, timestamp: new Date() }]);
        setSearchHistory([]);
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
          setSearchHistory(prev => [...prev, userMessage, aiResponse]);
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

  const highlightText = (str) => {
    const words = str.split(/(\s+)/);
    return words.map((word, i) => {
       if (/\d+/.test(word) && /[a-zA-Z%]+/.test(word) && !/^[A-Za-z]+$/.test(word)) {
           return <span key={i} className="text-slate-800 font-extrabold tracking-tight">{word}</span>;
       }
       if (/\b\d+\b/.test(word)) {
           return <span key={i} className="font-extrabold text-slate-800">{word}</span>;
       }
       const lower = word.toLowerCase().replace(/[^a-z]/g, '');
       if (['high', 'spike', 'danger', 'reduce', 'avoid'].includes(lower)) return <span key={i} className="text-rose-600 font-bold">{word}</span>;
       if (['low'].includes(lower)) return <span key={i} className="text-orange-500 font-bold">{word}</span>;
       if (['normal', 'safe', 'good', 'healthy', 'stable', 'add'].includes(lower)) return <span key={i} className="text-emerald-600 font-bold">{word}</span>;
       if (/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD10-\uDDFF]/.test(word)) {
           return <span key={i} className="text-lg inline-block drop-shadow-sm">{word}</span>;
       }
       return word;
    });
  };

  const renderFormattedText = (text) => {
    if (!text) return null;
    const lines = text.split('\n');
    return (
      <div className="space-y-1.5 w-full">
        {lines.map((line, i) => {
          if (!line.trim()) return null;
  
          const emojisInLine = line.match(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD10-\uDDFF]/g);
          const hasWarning = emojisInLine?.includes('⚠️') || line.toLowerCase().includes('spike') || line.toLowerCase().includes('high');
          const hasTime = emojisInLine?.includes('⏰') || line.toLowerCase().includes('time');
          const hasAction = emojisInLine?.includes('👉') || line.toLowerCase().includes('reduce') || line.toLowerCase().includes('add');
          const hasSuccess = emojisInLine?.includes('✅') || line.toLowerCase().includes('safe') || line.toLowerCase().includes('healthy');
  
          if (line.includes(':') && line.split(':')[0].length < 35 && (hasWarning || hasTime || hasAction || hasSuccess)) {
             const [labelRaw, ...rest] = line.split(':');
             const label = labelRaw.trim();
             const val = rest.join(':').trim();
             
             let Icon = Activity;
             let colorClass = 'text-blue-600 bg-[#f0f4ff]';
             let isSpikeGraph = false;
             
             if (hasWarning) { Icon = TrendingUp; colorClass = 'text-[#d62828] bg-[#fff5f5]'; isSpikeGraph = true; }
             else if (hasTime) { Icon = History; colorClass = 'text-[#e85d04] bg-[#fff8ee]'; }
             else if (hasAction) { Icon = Zap; colorClass = 'text-indigo-600 bg-[#f8f9ff]'; }
             else if (hasSuccess) { Icon = Check; colorClass = 'text-emerald-600 bg-[#f0fdf4]'; }
  
             return (
                <div key={i} className={`flex flex-col my-2 p-4 rounded-2xl w-full transition-all ${colorClass}`}>
                   <div className="flex items-center gap-3 mb-2">
                      <div className="w-7 h-7 bg-white rounded-full flex items-center justify-center">
                        <Icon strokeWidth={2.5} className="w-4 h-4" />
                      </div>
                      <span className="font-black text-xs uppercase tracking-widest">{label.replace(/[\u2700-\u27BF]|[\uE000-\uF8FF]|\uD83C[\uDC00-\uDFFF]|\uD83D[\uDC00-\uDFFF]|\uD83E[\uDD10-\uDDFF]/g, '').trim()}</span>
                   </div>
                   {val && <span className="text-lg font-extrabold leading-relaxed text-slate-800">{highlightText(val)}</span>}

                   {isSpikeGraph && (
                      <div className="mt-4 pt-4 border-t border-rose-100/50 w-full">
                         <svg viewBox="0 0 200 45" className="w-full h-12 text-[#d62828] overflow-visible">
                             <defs>
                               <linearGradient id="spikeGrad" x1="0" y1="0" x2="0" y2="1">
                                 <stop offset="0%" stopColor="currentColor" stopOpacity="0.15" />
                                 <stop offset="100%" stopColor="currentColor" stopOpacity="0" />
                               </linearGradient>
                             </defs>
                             <path d="M 0 40 L 40 40" stroke="#fecdd3" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                             <path d="M 160 40 L 200 40" stroke="#fecdd3" strokeWidth="2" strokeDasharray="4 4" fill="none" />
                             <path d="M 40 40 C 70 40, 80 5, 100 5 C 120 5, 130 40, 160 40" fill="url(#spikeGrad)" />
                             <path d="M 40 40 C 70 40, 80 5, 100 5 C 120 5, 130 40, 160 40" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" fill="none" />
                             <circle cx="100" cy="5" r="4" fill="currentColor" className="animate-pulse" />
                             <text x="100" y="20" fill="currentColor" fontSize="10" fontWeight="bold" textAnchor="middle">PEAK</text>
                         </svg>
                      </div>
                   )}
                </div>
             );
          }
  
          if (line.trim().startsWith('•') || line.trim().startsWith('-')) {
              const content = line.substring(line.indexOf('•') !== -1 ? line.indexOf('•') + 1 : line.indexOf('-') + 1).trim();
              return (
                <div key={i} className="flex gap-3 items-start pl-1 py-1.5">
                  <div className="w-5 h-5 rounded-full bg-slate-100 flex items-center justify-center shrink-0 mt-0.5">
                    <ChevronRight className="w-3 h-3 text-slate-500" />
                  </div>
                  <div className="flex-1 text-[15px] leading-relaxed font-bold text-slate-800">{highlightText(content)}</div>
                </div>
              );
          }
  
          return <p key={i} className="text-sm leading-relaxed font-medium py-1">{highlightText(line)}</p>;
        })}
      </div>
    );
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
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Recent Searches</p>
            {searchHistory.filter(m => m.role === 'user').length > 0 ? (
               <div className="space-y-2">
                 {searchHistory.filter(m => m.role === 'user').slice(-6).reverse().map((msg, idx) => (
                    <div 
                      key={idx} 
                      onClick={() => { setMessages(searchHistory); setSidebarOpen(false); }}
                      className="p-3.5 bg-white rounded-2xl border border-slate-100 text-[11px] font-bold text-slate-600 flex items-center gap-3 cursor-pointer hover:bg-slate-50 hover:border-slate-200 transition-all shadow-sm shadow-black/[0.01]"
                    >
                       <MessageSquare className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                       <span className="truncate flex-1">{msg.content}</span>
                    </div>
                 ))}
               </div>
            ) : (
               <div className="p-4 bg-white rounded-2xl border border-slate-100 text-[11px] font-bold text-slate-500 italic text-center">
                 No recent health queries.
               </div>
            )}
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

        {/* Mobile Sidebar Toggle Header */}
        <div className="md:hidden flex items-center justify-start px-4 py-3 bg-white/90 backdrop-blur-md border-b border-slate-100 z-20 sticky top-0 shadow-sm shadow-black/[0.02]">
           <button onClick={() => setSidebarOpen(true)} className="p-2 bg-slate-100 hover:bg-slate-200 rounded-xl transition-all active:scale-95 flex items-center justify-center gap-2">
             <History className="w-4 h-4 text-slate-700" />
           </button>
        </div>

        {/* Message Viewport - scrollable, with bottom padding for the fixed input dock */}
        <div ref={chatContainerRef} className="flex-1 overflow-y-auto px-6 pt-4 pb-44 md:pb-8 space-y-8 scroll-smooth flex flex-col z-10" style={{ minHeight: 0 }}>
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'} animate-in fade-in slide-in-from-bottom-4 duration-500`}>
              <div className={`flex gap-3 md:gap-4 w-full md:max-w-[75%] ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>
                {msg.role === 'assistant' && (
                  <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border border-slate-200 bg-white overflow-hidden">
                    <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/icon.png?v=1775538354" alt="Coach" className="w-full h-full object-cover" />
                  </div>
                )}
                <div className={`relative w-full md:w-auto flex flex-col ${msg.role === 'user' ? 'bg-slate-100 text-slate-800 rounded-3xl px-5 py-3.5' : 'bg-transparent text-slate-800 py-1 w-full max-w-none'}`}>
                  {msg.role === 'user' ? (
                     <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap max-w-none">
                       {msg.content}
                     </div>
                  ) : (
                     renderFormattedText(msg.content)
                  )}
                  <div className={`flex items-center mt-2 gap-4 ${msg.role === 'user' ? 'justify-end hidden' : 'justify-start text-slate-400 opacity-50 hover:opacity-100 transition-opacity'}`}>
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
                <div className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center border border-slate-200 bg-white overflow-hidden">
                  <img src="https://cdn.shopify.com/s/files/1/0636/5226/6115/files/icon.png?v=1775538354" alt="Coach" className="w-full h-full object-cover" />
                </div>
                <div className="relative w-full md:w-auto flex flex-col bg-transparent text-slate-800 py-1 w-full max-w-none">
                  {streamingText ? (
                    <div className="text-sm leading-relaxed font-medium whitespace-pre-wrap flex items-center">
                      {renderFormattedText(streamingText)}
                      <span className="inline-block w-1.5 h-4 ml-1 bg-black animate-pulse"></span>
                    </div>
                      ) : (
                        <div className="flex items-center gap-4 py-2">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                            className="w-4 h-4 rounded-full border-2 border-slate-200 border-t-black"
                          />
                          <div className="flex flex-col">
                            <motion.span 
                              key={loaderMessageIndex}
                              initial={{ opacity: 0, y: 5 }}
                              animate={{ opacity: 1, y: 0 }}
                              className="text-[10px] md:text-sm font-black uppercase tracking-[0.2em] text-slate-600"
                            >
                              {[
                                "Medical Coach Analyzing...",
                                "Reviewing Health Reports...",
                                "Optimizing Recommendations..."
                              ][loaderMessageIndex]}
                            </motion.span>
                            <span className="text-[8px] md:text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">Clinical Intelligence Active</span>
                          </div>

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
          <div className="max-w-4xl mx-auto relative">
            <form onSubmit={handleSubmit} className="relative group w-full">
              <div className="relative bg-white border border-slate-200 focus-within:border-slate-300 rounded-[2rem] p-2 flex items-center gap-2 transition-all shadow-lg shadow-black/[0.03]">
                <div className="hidden sm:flex w-10 h-10 items-center justify-center text-slate-300 shrink-0">
                  <MessageSquare className="w-5 h-5" />
                </div>
                <input
                  type="text"
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder="Ask about your health reports or upcoming meals..."
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
