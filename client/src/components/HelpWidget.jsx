import { useState, useEffect } from 'react';
import { MessageCircle, X, Send } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportService } from '../services/api';
import { motion } from 'framer-motion';

export default function HelpWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);
    const [isScrolled, setIsScrolled] = useState(false);
    const [isDesktop, setIsDesktop] = useState(window.innerWidth >= 768);

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
                        className="hidden md:block fixed bottom-36 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-emerald-600 text-white p-6 flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-bold">Contact Support</h3>
                                <p className="text-emerald-100 text-xs mt-1">We'll get back to you soon</p>
                            </div>
                            <button
                                onClick={() => setIsOpen(false)}
                                className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Form */}
                        <form onSubmit={handleSubmit} className="p-6 space-y-4">
                            {/* Subject */}
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

                            {/* Message */}
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

                            {/* Submit Button */}
                            <button
                                type="submit"
                                disabled={loading}
                                className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                            >
                                <Send className="w-4 h-4" />
                                {loading ? 'Sending...' : 'Send'}
                            </button>
                        </form>
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
                            className="w-full max-w-sm bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden"
                        >
                            {/* Header */}
                            <div className="bg-emerald-600 text-white p-6 flex items-center justify-between">
                                <div>
                                    <h3 className="text-lg font-bold">Contact Support</h3>
                                    <p className="text-emerald-100 text-xs mt-1">We'll get back to you soon</p>
                                </div>
                                <button
                                    onClick={() => setIsOpen(false)}
                                    className="p-2 hover:bg-emerald-700 rounded-lg transition-colors"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Form */}
                            <form onSubmit={handleSubmit} className="p-6 space-y-4">
                                {/* Subject */}
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

                                {/* Message */}
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

                                {/* Submit Button */}
                                <button
                                    type="submit"
                                    disabled={loading}
                                    className="w-full bg-emerald-600 text-white py-2 rounded-lg font-semibold text-sm hover:bg-emerald-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                                >
                                    <Send className="w-4 h-4" />
                                    {loading ? 'Sending...' : 'Send'}
                                </button>
                            </form>
                        </motion.div>
                    </motion.div>
                </>
            )}
        </>
    )
}
