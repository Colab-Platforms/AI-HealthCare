import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, X, Check, CheckCheck, Trash2, Clock, Utensils, Moon, BarChart3, Apple, Target, FileText, Sparkles } from 'lucide-react';
import { notificationService } from '../services/api';

const typeConfig = {
    food_reminder: { icon: Utensils, color: '#000000', bg: '#f8fafc' },
    sleep_reminder: { icon: Moon, color: '#000000', bg: '#f1f5f9' },
    macro_update: { icon: BarChart3, color: '#000000', bg: '#f8fafc' },
    diet_adherence: { icon: Apple, color: '#000000', bg: '#f1f5f9' },
    health_insight: { icon: Sparkles, color: '#000000', bg: '#f8fafc' },
    report_comparison: { icon: FileText, color: '#000000', bg: '#f1f5f9' },
    goal_progress: { icon: Target, color: '#000000', bg: '#f8fafc' }
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

    const handleNotificationClick = (notif) => {
        // Expand immediately so "View Details" appears without delay —
        // mark-as-read runs in the background instead of blocking the expand,
        // which previously created a timing window where a second click could
        // land on the still-collapsed row and re-collapse it before navigation.
        setExpandedId(prev => (prev === notif._id ? null : notif._id));
        if (!notif.read) {
            handleMarkAsRead(notif._id);
        }
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

    const typeColors = {
        food_reminder: '#059669',
        sleep_reminder: '#7c3aed',
        macro_update: '#0ea5e9',
        diet_adherence: '#f59e0b',
        health_insight: '#5B8C6F',
        report_comparison: '#6366f1',
        goal_progress: '#10b981',
    };

    return (
        <div
            ref={panelRef}
            className="fixed md:absolute top-[60px] md:top-12 right-2 md:right-0 w-[calc(100vw-16px)] md:w-[400px] max-h-[80vh] z-[100] flex flex-col rounded-[28px] overflow-hidden"
            style={{
                animation: 'slideDown 0.25s ease-out forwards',
                background: 'rgba(237,253,244,0.82)',
                backdropFilter: 'blur(48px) saturate(200%)',
                WebkitBackdropFilter: 'blur(48px) saturate(200%)',
                border: '1px solid rgba(255,255,255,0.85)',
                boxShadow: '0 20px 60px rgba(15,23,42,0.12), 0 4px 16px rgba(16,185,129,0.08), inset 0 1px 0 rgba(255,255,255,0.9)',
            }}
        >
            {/* Header */}
            <div className="px-5 py-4 flex items-center justify-between flex-shrink-0"
                style={{ borderBottom: '1px solid rgba(255,255,255,0.6)' }}>
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-2xl flex items-center justify-center"
                        style={{ background: 'rgba(91,140,111,0.12)', border: '1px solid rgba(91,140,111,0.2)' }}>
                        <Bell className="w-4 h-4 text-[#5B8C6F]" />
                    </div>
                    <div>
                        <h3 className="text-sm font-bold text-[#1a1a1a] tracking-tight">Notifications</h3>
                        {unreadCount > 0 && (
                            <p className="text-[10px] text-[#5B8C6F] font-semibold">{unreadCount} unread</p>
                        )}
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    {notifications.length > 0 && (
                        <>
                            <button onClick={handleMarkAllAsRead}
                                className="p-2 rounded-xl transition-colors group"
                                style={{ background: 'rgba(255,255,255,0.5)' }}
                                title="Mark all as read">
                                <CheckCheck className="w-3.5 h-3.5 text-[#5B8C6F]" />
                            </button>
                            <button onClick={handleClearAll}
                                className="p-2 rounded-xl transition-colors group"
                                style={{ background: 'rgba(255,255,255,0.5)' }}
                                title="Clear all">
                                <Trash2 className="w-3.5 h-3.5 text-[#a0a0a0] group-hover:text-red-400 transition-colors" />
                            </button>
                        </>
                    )}
                    <button onClick={onClose}
                        className="p-2 rounded-xl transition-colors"
                        style={{ background: 'rgba(255,255,255,0.5)' }}>
                        <X className="w-3.5 h-3.5 text-[#a0a0a0]" />
                    </button>
                </div>
            </div>

            {/* Notification List */}
            <div className="overflow-y-auto flex-1 px-3 py-2 space-y-2 scrollbar-hide">
                {loading ? (
                    <div className="flex items-center justify-center py-12">
                        <div className="w-7 h-7 border-2 border-[#5B8C6F]/20 border-t-[#5B8C6F] rounded-full animate-spin" />
                    </div>
                ) : notifications.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-14 px-6 text-center">
                        <div className="w-14 h-14 rounded-[20px] flex items-center justify-center mb-4"
                            style={{ background: 'rgba(91,140,111,0.08)', border: '1px solid rgba(91,140,111,0.15)' }}>
                            <Bell className="w-6 h-6 text-[#5B8C6F]/40" />
                        </div>
                        <p className="text-sm font-bold text-[#1a1a1a] mb-1">All caught up</p>
                        <p className="text-[11px] text-[#a0a0a0] font-medium leading-relaxed">
                            We'll notify you about meals, sleep, and health progress
                        </p>
                    </div>
                ) : (
                    notifications.map((notif) => {
                        const accentColor = typeColors[notif.type] || '#5B8C6F';
                        const IconComponent = (typeConfig[notif.type] || typeConfig.health_insight).icon;
                        const isExpanded = expandedId === notif._id;

                        return (
                            <div
                                key={notif._id}
                                onClick={() => handleNotificationClick(notif)}
                                className="group flex items-start gap-3 p-3.5 rounded-[18px] cursor-pointer transition-all"
                                style={{
                                    background: !notif.read ? 'rgba(255,255,255,0.75)' : 'rgba(255,255,255,0.45)',
                                    border: `1px solid ${!notif.read ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.6)'}`,
                                    boxShadow: !notif.read ? '0 2px 12px rgba(16,185,129,0.06)' : 'none',
                                }}
                            >
                                {/* Icon */}
                                <div className="w-9 h-9 rounded-2xl flex-shrink-0 flex items-center justify-center mt-0.5"
                                    style={{ background: `${accentColor}12`, border: `1px solid ${accentColor}25` }}>
                                    <IconComponent className="w-4 h-4" style={{ color: accentColor }} />
                                </div>

                                {/* Content */}
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-start justify-between gap-2">
                                        <h4 className={`text-[13px] leading-tight ${!notif.read ? 'font-bold text-[#1a1a1a]' : 'font-semibold text-[#444]'}`}>
                                            {notif.title}
                                        </h4>
                                        {!notif.read && (
                                            <div className="w-2 h-2 rounded-full flex-shrink-0 mt-1.5"
                                                style={{ background: accentColor }} />
                                        )}
                                    </div>
                                    <p className={`text-[11px] text-[#888] mt-0.5 leading-relaxed font-medium ${!isExpanded ? 'line-clamp-2' : ''}`}>
                                        {notif.message}
                                    </p>

                                    {isExpanded && notif.actionUrl && (
                                        <button
                                            onClick={(e) => handleActionClick(notif, e)}
                                            className="mt-2.5 text-[11px] font-bold px-3 py-1.5 rounded-xl text-white transition-all"
                                            style={{ background: `linear-gradient(135deg, ${accentColor}, ${accentColor}cc)` }}
                                        >
                                            View Details
                                        </button>
                                    )}

                                    {notif.type === 'macro_update' && notif.metadata && (
                                        <div className="flex gap-1.5 mt-2 flex-wrap">
                                            {['calories', 'protein', 'carbs', 'fats'].map(macro => {
                                                const data = notif.metadata?.[macro];
                                                if (!data) return null;
                                                return (
                                                    <div key={macro}
                                                        className="px-2 py-0.5 rounded-lg text-[9px] font-bold uppercase tracking-wider"
                                                        style={{ background: 'rgba(91,140,111,0.1)', color: '#5B8C6F' }}>
                                                        {macro}: {data.pct || 0}%
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}

                                    <div className="flex items-center gap-1.5 mt-1.5">
                                        <Clock className="w-2.5 h-2.5 text-[#c0c0c0]" />
                                        <span className="text-[9px] text-[#b0b0b0] font-semibold">{formatTime(notif.createdAt)}</span>
                                    </div>
                                </div>

                                {/* Actions */}
                                <div className="flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col gap-1 mt-0.5">
                                    {!notif.read && (
                                        <button
                                            onClick={(e) => { e.stopPropagation(); handleMarkAsRead(notif._id); }}
                                            className="p-1.5 rounded-lg transition-colors"
                                            style={{ background: 'rgba(91,140,111,0.1)' }}
                                            title="Mark as read">
                                            <Check className="w-3 h-3 text-[#5B8C6F]" />
                                        </button>
                                    )}
                                    <button
                                        onClick={(e) => { e.stopPropagation(); handleDelete(notif._id); }}
                                        className="p-1.5 rounded-lg hover:bg-red-50 transition-colors"
                                        title="Delete">
                                        <X className="w-3 h-3 text-[#d0d0d0] hover:text-red-400" />
                                    </button>
                                </div>
                            </div>
                        );
                    })
                )}
            </div>

            <style>{`
        @keyframes slideDown {
          from { opacity: 0; transform: translateY(-8px) scale(0.97); }
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
