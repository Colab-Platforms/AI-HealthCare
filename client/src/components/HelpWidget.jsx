import { useState } from 'react';
import { MessageCircle, X, Send, AlertCircle, Lightbulb, HelpCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { supportService } from '../services/api';

export default function HelpWidget() {
    const [isOpen, setIsOpen] = useState(false);
    const [category, setCategory] = useState('general_help');
    const [subject, setSubject] = useState('');
    const [message, setMessage] = useState('');
    const [loading, setLoading] = useState(false);

    const categories = [
        { value: 'bug', label: '🐛 Bug Report', icon: AlertCircle },
        { value: 'feature_request', label: '💡 Feature Request', icon: Lightbulb },
        { value: 'general_help', label: '❓ General Help', icon: HelpCircle },
        { value: 'account_issue', label: '👤 Account Issue', icon: AlertCircle }
    ];

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
                category
            });

            toast.success('Thank you! We received your message. Our team will respond soon.');
            setSubject('');
            setMessage('');
            setCategory('general_help');
            setIsOpen(false);
        } catch (error) {
            toast.error('Failed to send message');
        } finally {
            setLoading(false);
        }
    };

    return (
        <>
            <button
                onClick={() => setIsOpen(!isOpen)}
                className="fixed bottom-6 right-6 w-14 h-14 bg-indigo-600 text-white rounded-full shadow-lg hover:bg-indigo-700 transition-all flex items-center justify-center z-40 hover:scale-110"
                title="Need help?"
            >
                <MessageCircle className="w-6 h-6" />
            </button>

            {/* Modal */}
            {isOpen && (
                <div className="fixed bottom-24 right-6 w-96 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden">
                    {/* Header */}
                    <div className="bg-indigo-600 text-white p-6 flex items-center justify-between">
                        <div>
                            <h3 className="text-lg font-black">How can we help?</h3>
                            <p className="text-indigo-100 text-xs mt-1">We're here to assist you</p>
                        </div>
                        <button
                            onClick={() => setIsOpen(false)}
                            className="p-2 hover:bg-indigo-700 rounded-lg transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Form */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4">
                        {/* Category */}
                        <div>
                            <label className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 block">
                                Issue Type
                            </label>
                            <select
                                value={category}
                                onChange={(e) => setCategory(e.target.value)}
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                            >
                                {categories.map(cat => (
                                    <option key={cat.value} value={cat.value}>{cat.label}</option>
                                ))}
                            </select>
                        </div>

                        {/* Subject */}
                        <div>
                            <label className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 block">
                                Subject
                            </label>
                            <input
                                type="text"
                                value={subject}
                                onChange={(e) => setSubject(e.target.value)}
                                placeholder="Brief description..."
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm"
                            />
                        </div>

                        {/* Message */}
                        <div>
                            <label className="text-xs font-black text-slate-600 uppercase tracking-wider mb-2 block">
                                Message
                            </label>
                            <textarea
                                value={message}
                                onChange={(e) => setMessage(e.target.value)}
                                placeholder="Tell us more about your issue..."
                                rows="4"
                                className="w-full px-4 py-2 border border-slate-200 rounded-lg focus:ring-2 focus:ring-indigo-600 focus:border-transparent text-sm resize-none"
                            />
                        </div>

                        {/* Submit Button */}
                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-indigo-600 text-white py-2 rounded-lg font-black text-sm uppercase tracking-wider hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                        >
                            <Send className="w-4 h-4" />
                            {loading ? 'Sending...' : 'Send Message'}
                        </button>
                    </form>
                </div>
            )}
        </>
    )

}