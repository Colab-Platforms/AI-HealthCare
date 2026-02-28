import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck, Trash2, Clock, Utensils, Moon, BarChart3, Apple, Target, FileText, Sparkles } from 'lucide-react';
import { notificationService } from '../services/api';

const typeConfig = {
    food_reminder: { icon: Utensils, color: '#FF6B35', bg: '#FFF4EE' },
    sleep_reminder: { icon: Moon, color: '#6C5CE7', bg: '#F3F0FF' },
    macro_update: { icon: BarChart3, color: '#2FC8B9', bg: '#EEFBF9' },
    diet_adherence: { icon: Apple, color: '#00B894', bg: '#E8FDF5' },
    health_insight: { icon: Sparkles, color: '#E17055', bg: '#FFF0ED' },
    report_comparison: { icon: FileText, color: '#0984E3', bg: '#E8F4FD' },
    goal_progress: { icon: Target, color: '#FDCB6E', bg: '#FFFBE8' }
};

export default function NotificationPanel({ isOpen, onClose, triggerRef }) {
    const [notifications, setNotifications] = useState([]);
    const [unreadCount, setUnreadCount] = useState(0);
    const [loading, setLoading] = useState(false);
    const panelRef = useRef(null);
    const navigate = useNavigate();

    const [expandedId, setExpandedId] = useState(null);

    async function fetchNotifications() {
        setLoading(true);
        try {
            const { data } = await notificationService.getAll();
            if (data.success) {
                setNotifications(data.notifications);
                setUnreadCount(typeof data.unreadCount === 'number' ? data.unreadCount : (data.notifications?.filter(n => !n.read).length || 0));
            }
        } catch (error) {
            console.error('Failed to fetch notifications:', error);
        } finally {
            setLoading(false);
        }
    }

    async function fetchUnreadCount() {
        try {
            const { data } = await notificationService.getUnreadCount();
            if (data && typeof data.unreadCount !== 'undefined') {
                const count = typeof data.unreadCount === 'object' ? data.unreadCount.unreadCount : data.unreadCount;
                setUnreadCount(Number(count) || 0);
            }
        } catch (error) {
            console.error('Error fetching notification count:', error);
        }
    }

    useEffect(() => {
        if (isOpen) {
            fetchNotifications();
        }
    }, [isOpen]);

    // Fetch unread count periodically
    useEffect(() => {
        fetchUnreadCount();
        const interval = setInterval(fetchUnreadCount, 60000); // Check every minute
        return () => clearInterval(interval);
    }, []);

    // Close panel when clicking outside
    useEffect(() => {
        const handleClickOutside = (e) => {
            if (
                panelRef.current &&
                !panelRef.current.contains(e.target) &&
                triggerRef?.current &&
                !triggerRef.current.contains(e.target)
            ) {
                onClose();
            }
        };
        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, [isOpen, onClose, triggerRef]);

    const handleMarkAsRead = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await notificationService.markAsRead(id);
            setNotifications(prev =>
                prev.map(n => n._id === id ? { ...n, read: true } : n)
            );
            setUnreadCount(prev => Math.max(0, prev - 1));
        } catch (error) {
            console.error('Failed to mark as read:', error);
        }
    };

    const handleMarkAllAsRead = async () => {
        try {
            await notificationService.markAllAsRead();
            setNotifications(prev => prev.map(n => ({ ...n, read: true })));
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to mark all as read:', error);
        }
    };

    const handleDelete = async (id, e) => {
        if (e) e.stopPropagation();
        try {
            await notificationService.deleteOne(id);
            setNotifications(prev => prev.filter(n => n._id !== id));
        } catch (error) {
            console.error('Failed to delete:', error);
        }
    };

    const handleClearAll = async () => {
        try {
            await notificationService.clearAll();
            setNotifications([]);
            setUnreadCount(0);
        } catch (error) {
            console.error('Failed to clear all:', error);
        }
    };

    const handleNotificationClick = async (notif) => {
        if (!notif.read) {
            await handleMarkAsRead(notif._id);
        }
        setExpandedId(prev => (prev === notif._id ? null : notif._id));
    };

    const handleActionClick = (notif, e) => {
        e.stopPropagation();
        if (notif.actionUrl) {
            navigate(notif.actionUrl);
            onClose();
        }
    };

    const formatTime = (dateStr) => {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMin = Math.floor(diffMs / 60000);
        const diffHr = Math.floor(diffMs / 3600000);
        const diffDay = Math.floor(diffMs / 86400000);

        if (diffMin < 1) return 'Just now';
        if (diffMin < 60) return `${diffMin}m ago`;
        if (diffHr < 24) return `${diffHr}h ago`;
        if (diffDay < 7) return `${diffDay}d ago`;
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    };

    if (!isOpen) {
        return null;
    }

    return (
        <div
            ref={panelRef}
            className="fixed md:absolute top-16 md:top-14 right-2 md:right-0 w-[calc(100vw-16px)] md:w-[420px] max-h-[80vh] bg-white rounded-3xl shadow-2xl border border-slate-100 z-[100] overflow-hidden flex flex-col"
            style={{
                animation: 'slideDown 0.3s ease-out forwards',
                boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.15), 0 12px 24px -6px rgba(0, 0, 0, 0.1)'
            }}
        >
            {/* Header */}
            <div className="sticky top-0 bg-white/95 backdrop-blur-md px-5 py-4 border-b border-slate-100 flex items-center justify-between z-10 flex-shrink-0">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#2FC8B9]/10 flex items-center justify-center">
                        <Bell className="w-5 h-5 text-[#2FC8B9]" />
                    </div>
                    <div>
                        <h3 className="text-sm font-black text-black uppercase tracking-wider">Notifications</h3>
                        {unreadCount > 0 && (
                            <p className="text-[10px] text-[#2FC8B9] font-bold">{unreadCount} unread</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    {notifications.length > 0 && (
                        <>
                            <button
                                onClick={handleMarkAllAsRead}
                                className="p-2 rounded-xl hover:bg-slate-100 transition-colors group"
                                title="Mark all as read"
                            >
                                <CheckCheck className="w-4 h-4 text-slate-400 group-hover:text-[#2FC8B9]" />
                            </button>
                            <button
                                onClick={handleClearAll}
                                className="p-2 rounded-xl hover:bg-red-50 transition-colors group"
                                title="Clear all"
                            >
                                <Trash2 className="w-4 h-4 text-slate-400 group-hover:text-red-500" />
                            </button>
                        </>
                    )}
                    <button
                        onClick={onClose}
                        className="p-2 rounded-xl hover:bg-slate-100 transition-colors"
                    >
                        <X className="w-4 h-4 text-slate-400" />
                    </button>
                </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-8 h-8 border-3 border-[#2FC8B9]/20 border-t-[#2FC8B9] rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-16 px-8 text-center">
                        <div className="w-16 h-16 rounded-full bg-slate-50 flex items-center justify-center mb-4">
                            <Bell className="w-8 h-8 text-slate-300" />
                        </div>
                        <p className="text-sm font-bold text-slate-500">No notifications yet</p>
                        <p className="text-xs text-slate-400 mt-1">
                            We'll notify you about meals, sleep, and health progress
                        </p>
                    </div>
                ) : (
                    <div className="py-2">
                        {notifications.map((notif) => {
                            const config = typeConfig[notif.type] || typeConfig.health_insight;
                            const IconComponent = config.icon;
                            const isExpanded = expandedId === notif._id;

                            return (
                                <div
                                    key={notif._id}
                                    onClick={() => handleNotificationClick(notif)}
                                    className={`group flex items-start gap-3 px-5 py-4 cursor-pointer transition-all
                    ${!notif.read ? 'bg-[#2FC8B9]/[0.03]' : 'hover:bg-slate-50'}
                    border-b border-slate-50 last:border-b-0`}
                                >
                                    {/* Icon */}
                                    <div
                                        className="w-10 h-10 rounded-2xl flex-shrink-0 flex items-center justify-center mt-0.5 transition-transform group-hover:scale-105"
                                        style={{ backgroundColor: config.bg }}
                                    >
                                        <IconComponent className="w-5 h-5" style={{ color: config.color }} />
                                    </div>

                                    {/* Content */}
                                    <div className="flex-1 min-w-0">
                                        <div className="flex items-start justify-between gap-2">
                                            <h4 className={`text-sm leading-tight ${!notif.read ? 'font-black text-black' : 'font-bold text-slate-700'}`}>
                                                {notif.title}
                                            </h4>
                                            {!notif.read && (
                                                <div className="w-2.5 h-2.5 rounded-full bg-[#2FC8B9] flex-shrink-0 mt-1.5 animate-pulse" />
                                            )}
                                        </div>
                                        <p className={`text-xs text-slate-500 mt-1 leading-relaxed ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                            {notif.message}
                                        </p>

                                        {isExpanded && notif.actionUrl && (
                                            <button
                                                onClick={(e) => handleActionClick(notif, e)}
                                                className="mt-3 text-xs font-bold px-3 py-1.5 rounded-lg bg-[#2FC8B9]/10 text-[#2FC8B9] hover:bg-[#2FC8B9]/20 transition-colors"
                                            >
                                                View Details
                                            </button>
                                        )}

                                        {/* Macro Details */}
                                        {notif.type === 'macro_update' && notif.metadata && (
                                            <div className="flex gap-2 mt-2 flex-wrap">
                                                {['calories', 'protein', 'carbs', 'fats'].map(macro => {
                                                    const data = notif.metadata?.[macro];
                                                    if (!data) return null;
                                                    const pct = data.pct || 0;

                                                    return (
                                                        <div
                                                            key={macro}
                                                            className="px-2 py-1 rounded-lg text-[10px] font-bold"
                                                            style={{
                                                                backgroundColor: pct >= 80 && pct <= 110 ? '#EEFBF9' : pct > 110 ? '#FFF0ED' : '#FFF8E1',
                                                                color: pct >= 80 && pct <= 110 ? '#2FC8B9' : pct > 110 ? '#E17055' : '#F39C12'
                                                            }}
                                                        >
                                                            {macro.charAt(0).toUpperCase() + macro.slice(1)}: {pct}%
                                                        </div>
                                                    );
                                                })}
                                            </div>
                                        )}

                                        <div className="flex items-center gap-2 mt-2">
                                            <Clock className="w-3 h-3 text-slate-300" />
                                            <span className="text-[10px] text-slate-400 font-bold">{formatTime(notif.createdAt)}</span>
                                        </div>
                                    </div>

                                    {/* Actions */}
                                    <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1 mt-1">
                                        {!notif.read && (
                                            <button
                                                onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif._id); }}
                                                className="p-1.5 rounded-lg hover:bg-[#2FC8B9]/10 transition-colors"
                                                title="Mark as read"
                                            >
                                                <Check className="w-3.5 h-3.5 text-[#2FC8B9]" />
                                            </button>
                                        )}
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleDelete(notif._id); }}
                                            className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                            title="Delete"
                                        >
                                            <X className="w-3.5 h-3.5 text-red-400" />
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                )}
            </div>

            <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-10px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .line-clamp-2 {
          display: -webkit-box;
          -webkit-line-clamp: 2;
          -webkit-box-orient: vertical;
          overflow: hidden;
        }
      `}</style>
        </div>
    );
}

// Export a hook to use unread count from anywhere
export function useNotificationCount() {
    const [unreadCount, setUnreadCount] = useState(0);

    useEffect(() => {
        const fetchCount = async () => {
            try {
                const { data } = await notificationService.getUnreadCount();
                if (data && typeof data.unreadCount !== 'undefined') {
                    const count = typeof data.unreadCount === 'object' ? data.unreadCount.unreadCount : data.unreadCount;
                    setUnreadCount(Number(count) || 0);
                }
            } catch (error) {
                console.error('Error fetching notification count in hook:', error);
            }
        };

        fetchCount();
        const interval = setInterval(fetchCount, 30000);
        return () => clearInterval(interval);
    }, []);

    return typeof unreadCount === 'object' ? (unreadCount.unreadCount || 0) : (unreadCount || 0);
}
