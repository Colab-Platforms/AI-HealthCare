import { useState, useEffect, useRef } from 'react';
import { MessageCircle, X, Send, Sparkles, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportService } from '../services/api';
import { motion } from 'framer-motion';

export default function HelpWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [activeTab, setActiveTab] = useState('support'); // 'support' or 'ai-chat'
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);
    
    // AI Chat states
    const [chatMessages, setChatMessages] = useState([]);
    const [chatInput, setChatInput] = useState('');
    const [chatLoading, setChatLoading] = useState(false);
    
    // Ref for auto-scroll
    const chatScrollRef = useRef(null);

    // Detect scroll and screen size
    useEffect(() => {
        const handleScroll = () => {
            setIsScrolled(window.scrollY > 100);
        };

        const handleResize = () => {
            setIsDesktop(window.innerWidth >= 768);
        };

        window.addEventListener('scroll', handleScroll);
        window.addEventListener('resize', handleResize);
        return () => {
            window.removeEventListener('scroll', handleScroll);
            window.removeEventListener('resize', handleResize);
        };
    }, []);

    // Auto-scroll to bottom when new messages arrive
    useEffect(() => {
        if (chatScrollRef.current) {
            chatScrollRef.current.scrollTop = chatScrollRef.current.scrollHeight;
        }
    }, [chatMessages, chatLoading]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!subject.trim() || !message.trim()) {
            toast.error('Please fill in all fields')
            return;
        }

        setLoading(true);

        try {
            await supportService.createTicket({
                subject,
                message,
                category: 'general_help'
            });

            toast.success('Thank you! We received your message.');
            setSubject('');
            setMessage('');
            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    const handleAIChatSend = async () => {
        if (!chatInput.trim()) return;

        const userMessage = { role: 'user', content: chatInput };
        setChatMessages([...chatMessages, userMessage]);
        const currentInput = chatInput;
        setChatInput('');
        setChatLoading(true);

        try {
            let fullResponse = '';
            
            await supportService.aiChat(
                { message: currentInput },
                (chunk) => {
                    // Add chunk to response as it arrives
                    fullResponse += chunk;
                    setChatMessages((prev) => {
                        const lastMessage = prev[prev.length - 1];
                        if (lastMessage && lastMessage.role === 'ai') {
                            // Update existing AI message
                            return [
                                ...prev.slice(0, -1),
                                { role: 'ai', content: fullResponse }
                            ];
                        } else {
                            // Create new AI message
                            return [...prev, { role: 'ai', content: fullResponse }];
                        }
                    });
                }
            );
            
            setChatLoading(false);
        } catch (error) {
            console.error('Chat error:', error);
            setChatLoading(false);
            toast.error(error.message || 'Error communicating with AI');
        }
    };

    return (
        <>
            <motion.button
                onClick={() => setIsOpen(!isOpen)}
                animate={{
                    bottom: isScrolled ? (isDesktop ? 85 : 150) : (isDesktop ? 24 : 95)
                }}
                transition={{
                    type: 'spring',
                    stiffness: 300,
                    damping: 30
                }}
                className="fixed right-5 md:right-8 w-12 h-12 bg-emerald-600 text-white rounded-full shadow-lg hover:bg-emerald-700 transition-all flex items-center justify-center z-40 hover:scale-110"
                title="Need help?"
            >
                <MessageCircle className="w-6 h-6" />
            </motion.button>

            {/* Modal */}
            {isOpen && (
                <>
                    {/* Desktop: Popover next to button */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="hidden md:flex fixed bottom-36 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 flex-col"
                        style={{ height: '500px', maxHeight: '500px' }}
                    >
                        {/* Header - Fixed Height */}
                        <div className="bg-emerald-600 text-white p-6 flex items-center justify-between" style={{ flexShrink: 0 }}>
                            <div>
                                <h3 className="text-lg font-bold">Support Center</h3>
                                <p className="text-emerald-100 text-xs mt-1">Get help or talk to AI</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Tabs - Fixed Height */}
                        <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50" style={{ flexShrink: 0 }}>
                            <button
                                onClick={() => setActiveTab('support')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 ${
                                    activeTab === 'support'
                                        ? 'border-emerald-600 text-emerald-600 bg-white'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                Report Issue
                            </button>
                            <button
                                onClick={() => setActiveTab('ai-chat')}
                                className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 flex items-center gap-1 ${
                                    activeTab === 'ai-chat'
                                        ? 'border-emerald-600 text-emerald-600 bg-white'
                                        : 'border-transparent text-slate-600 hover:text-slate-900'
                                }`}
                            >
                                <Sparkles className="w-4 h-4" />
                                AI Help
                            </button>
                        </div>

                        {/* Content Area - Fill remaining space */}
                        <div className="flex-1 overflow-hidden flex flex-col bg-white">
                            {activeTab === 'support' && (
                                <form onSubmit={handleSubmit} className="flex flex-col h-full" style={{ minHeight: 0 }}>
                                    {/* Form Content - Scrollable */}
                                    <div style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} className="p-6 space-y-4">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                                Subject
                                            </label>
                                            <input
                                                type="text"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                placeholder="What do you need help with?"
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                                Message
                                            </label>
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Describe your issue..."
                                                rows="4"
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm resize-none"
                                            />
                                        </div>
                                    </div>

                                    {/* Submit Button - Sticky at Bottom */}
                                    <div style={{ flexShrink: 0 }} className="border-t border-slate-200 p-6 bg-white">
                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            {loading ? 'Sending...' : 'Send'}
                                        </button>
                                    </div>
                                </form>
                            )}

                            {activeTab === 'ai-chat' && (
                                <div className="flex flex-col h-full" style={{ minHeight: 0 }}>
                                    {/* Chat Messages - Scrollable */}
                                    <div 
                                        ref={chatScrollRef}
                                        style={{ flex: 1, overflowY: 'auto', minHeight: 0 }} 
                                        className="space-y-4 p-4"
                                    >
                                        {chatMessages.length === 0 ? (
                                            <div className="flex items-center justify-center h-full">
                                                <div className="text-center space-y-2">
                                                    <Sparkles className="w-8 h-8 text-emerald-600 mx-auto" />
                                                    <h4 className="text-sm font-bold text-slate-900">AI Assistant</h4>
                                                    <p className="text-xs text-slate-500">Ask me anything about our platform!</p>
                                                </div>
                                            </div>
                                        ) : (
                                            chatMessages.map((msg, i) => (
                                                <motion.div
                                                    key={i}
                                                    initial={{ opacity: 0, y: 10 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                >
                                                    <div
                                                        className={`max-w-xs px-3 py-2 rounded-xl text-sm break-words ${
                                                            msg.role === 'user'
                                                                ? 'bg-emerald-600 text-white'
                                                                : 'bg-slate-100 text-slate-900'
                                                        }`}
                                                    >
                                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                                    </div>
                                                </motion.div>
                                            ))
                                        )}
                                        {chatLoading && (
                                            <div className="flex justify-start">
                                                <div className="bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-2">
                                                    <Loader className="w-4 h-4 animate-spin text-emerald-600" />
                                                    <span className="text-xs text-slate-600">Thinking...</span>
                                                </div>
                                            </div>
                                        )}
                                    </div>

                                    {/* Chat Input - Fixed at Bottom */}
                                    <div style={{ flexShrink: 0 }} className="flex gap-2 border-t border-slate-200 p-4 bg-white">
                                        <input
                                            type="text"
                                            value={chatInput}
                                            onChange={(e) => setChatInput(e.target.value)}
                                            onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleAIChatSend()}
                                            placeholder="Ask AI..."
                                            className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-xs"
                                        />
                                        <button
                                            onClick={handleAIChatSend}
                                            disabled={chatLoading || !chatInput.trim()}
                                            className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                        >
                                            <Send className="w-3 h-3" />
                                        </button>
                                    </div>
                                </div>
                            )}
                        </div>
                    </motion.div>

                    {/* Mobile: Centered modal */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 30 }}
                        className="md:hidden fixed inset-0 flex items-center justify-center p-4 z-50"
                    >
                        <motion.div
                            initial={{ scale: 0.95, y: 20 }}
                            animate={{ scale: 1, y: 0 }}
                            exit={{ scale: 0.95, y: 20 }}
                            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[90vh]"
                        >
                            {/* Header */}
                            <div className="bg-emerald-600 text-white p-6 flex items-center justify-between flex-shrink-0">
                                <div>
                                    <h3 className="text-lg font-bold">Support Center</h3>
                                    <p className="text-emerald-100 text-xs mt-1">Get help or talk to AI</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Tabs */}
                            <div className="flex gap-2 px-6 pt-4 border-b border-slate-200 bg-slate-50 flex-shrink-0">
                                <button
                                    onClick={() => setActiveTab('support')}
                                    className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 ${
                                        activeTab === 'support'
                                            ? 'border-emerald-600 text-emerald-600 bg-white'
                                            : 'border-transparent text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    Report Issue
                                </button>
                                <button
                                    onClick={() => setActiveTab('ai-chat')}
                                    className={`px-4 py-2 rounded-t-lg text-sm font-bold transition-all border-b-2 flex items-center gap-1 ${
                                        activeTab === 'ai-chat'
                                            ? 'border-emerald-600 text-emerald-600 bg-white'
                                            : 'border-transparent text-slate-600 hover:text-slate-900'
                                    }`}
                                >
                                    <Sparkles className="w-4 h-4" />
                                    AI Help
                                </button>
                            </div>

                            {/* Content */}
                            <div className="flex-1 overflow-hidden flex flex-col">
                                {activeTab === 'support' && (
                                    <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1 overflow-y-auto">
                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                                Subject
                                            </label>
                                            <input
                                                type="text"
                                                value={subject}
                                                onChange={(e) => setSubject(e.target.value)}
                                                placeholder="What do you need help with?"
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm"
                                            />
                                        </div>

                                        <div>
                                            <label className="text-xs font-semibold text-slate-700 mb-2 block">
                                                Message
                                            </label>
                                            <textarea
                                                value={message}
                                                onChange={(e) => setMessage(e.target.value)}
                                                placeholder="Describe your issue..."
                                                rows="4"
                                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-sm resize-none"
                                            />
                                        </div>

                                        <button
                                            type="submit"
                                            disabled={loading}
                                            className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                        >
                                            <Send className="w-4 h-4" />
                                            {loading ? 'Sending...' : 'Send'}
                                        </button>
                                    </form>
                                )}

                                {activeTab === 'ai-chat' && (
                                    <div className="flex flex-col p-6 gap-4 h-full">
                                        {/* Chat Messages */}
                                        <div 
                                            ref={chatScrollRef}
                                            className="flex-1 overflow-y-auto space-y-4 min-h-[250px]"
                                        >
                                            {chatMessages.length === 0 ? (
                                                <div className="flex items-center justify-center h-full">
                                                    <div className="text-center space-y-2">
                                                        <Sparkles className="w-8 h-8 text-emerald-600 mx-auto" />
                                                        <h4 className="text-sm font-bold text-slate-900">AI Assistant</h4>
                                                        <p className="text-xs text-slate-500">Ask me anything about our platform!</p>
                                                    </div>
                                                </div>
                                            ) : (
                                                chatMessages.map((msg, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                                                    >
                                                        <div
                                                            className={`max-w-xs px-3 py-2 rounded-xl text-sm ${
                                                                msg.role === 'user'
                                                                    ? 'bg-emerald-600 text-white'
                                                                    : 'bg-slate-100 text-slate-900'
                                                            }`}
                                                        >
                                                            <p className="whitespace-pre-wrap">{msg.content}</p>
                                                        </div>
                                                    </motion.div>
                                                ))
                                            )}
                                            {chatLoading && (
                                                <div className="flex justify-start">
                                                    <div className="bg-slate-100 px-3 py-2 rounded-xl flex items-center gap-2">
                                                        <Loader className="w-4 h-4 animate-spin text-emerald-600" />
                                                        <span className="text-xs text-slate-600">Thinking...</span>
                                                    </div>
                                                </div>
                                            )}
                                        </div>

                                        {/* Chat Input */}
                                        <div className="flex gap-2 border-t border-slate-200 pt-3">
                                            <input
                                                type="text"
                                                value={chatInput}
                                                onChange={(e) => setChatInput(e.target.value)}
                                                onKeyDown={(e) => e.key === 'Enter' && !chatLoading && handleAIChatSend()}
                                                placeholder="Ask AI..."
                                                className="flex-1 px-3 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-emerald-600 focus:border-transparent text-xs"
                                            />
                                            <button
                                                onClick={handleAIChatSend}
                                                disabled={chatLoading || !chatInput.trim()}
                                                className="px-3 py-2 bg-emerald-600 text-white rounded-lg font-bold text-xs flex items-center gap-1 hover:bg-emerald-700 transition-colors disabled:opacity-50"
                                            >
                                                <Send className="w-3 h-3" />
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </>
    )
}
