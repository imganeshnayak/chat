import { useState, useEffect, useRef } from "react";
import { Bell, X, CheckCheck, Info, AlertTriangle, CheckCircle, AlertCircle } from "lucide-react";
import { getNotifications, markNotificationRead, markAllNotificationsRead, Notification } from "@/lib/api";
import { toast } from "sonner";
import { io as socketIO } from "socket.io-client";
import { useAuth } from "@/contexts/AuthContext";

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

const typeConfig = {
    info: { icon: Info, color: "text-blue-400", bg: "bg-blue-500/10", border: "border-blue-500/30", label: "Info" },
    warning: { icon: AlertTriangle, color: "text-yellow-400", bg: "bg-yellow-500/10", border: "border-yellow-500/30", label: "Warning" },
    success: { icon: CheckCircle, color: "text-green-400", bg: "bg-green-500/10", border: "border-green-500/30", label: "Success" },
    alert: { icon: AlertCircle, color: "text-red-400", bg: "bg-red-500/10", border: "border-red-500/30", label: "Alert" },
};

function timeAgo(dateStr: string) {
    const diff = Date.now() - new Date(dateStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

export default function NotificationBell() {
    const { user, token } = useAuth();
    const [open, setOpen] = useState(false);
    const [notifications, setNotifications] = useState<Notification[]>([]);
    const panelRef = useRef<HTMLDivElement>(null);

    const unreadCount = notifications.filter(n => !n.isRead).length;

    // Load notifications on mount
    useEffect(() => {
        if (!token) return;
        getNotifications()
            .then(setNotifications)
            .catch(() => { });
    }, [token]);

    // Socket.IO: listen for real-time broadcasts
    useEffect(() => {
        if (!token || !user) return;

        const socket = socketIO(API_URL, { auth: { token } });

        socket.on("admin:notification", (notification: Notification) => {
            setNotifications(prev => [notification, ...prev]);

            // Show toast based on type
            const cfg = typeConfig[notification.type] || typeConfig.info;
            const toastFn = notification.type === "alert" ? toast.error
                : notification.type === "warning" ? toast.warning
                    : notification.type === "success" ? toast.success
                        : toast.info;

            toastFn(`📢 ${notification.title}`, {
                description: notification.message,
                duration: 6000,
            });
        });

        return () => { socket.disconnect(); };
    }, [token, user]);

    // Close panel on outside click
    useEffect(() => {
        const handler = (e: MouseEvent) => {
            if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
                setOpen(false);
            }
        };
        if (open) document.addEventListener("mousedown", handler);
        return () => document.removeEventListener("mousedown", handler);
    }, [open]);

    const handleMarkRead = async (id: number) => {
        try {
            await markNotificationRead(id);
            setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
        } catch { }
    };

    const handleMarkAllRead = async () => {
        try {
            await markAllNotificationsRead();
            setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
        } catch { }
    };

    return (
        <div className="relative" ref={panelRef}>
            {/* Bell Button */}
            <button
                onClick={() => setOpen(o => !o)}
                className="relative p-2 rounded-full hover:bg-white/10 transition-colors"
                aria-label="Notifications"
            >
                <Bell className="w-5 h-5 text-white/80" />
                {unreadCount > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center px-1 animate-pulse">
                        {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                )}
            </button>

            {/* Panel */}
            {open && (
                <div className="absolute right-0 top-10 w-80 sm:w-96 z-50 rounded-2xl shadow-2xl border border-white/10 bg-gray-900/95 backdrop-blur-xl overflow-hidden">
                    {/* Header */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
                        <div className="flex items-center gap-2">
                            <Bell className="w-4 h-4 text-purple-400" />
                            <span className="font-semibold text-white text-sm">Notifications</span>
                            {unreadCount > 0 && (
                                <span className="bg-red-500 text-white text-[10px] font-bold rounded-full px-1.5 py-0.5">
                                    {unreadCount}
                                </span>
                            )}
                        </div>
                        <div className="flex items-center gap-1">
                            {unreadCount > 0 && (
                                <button
                                    onClick={handleMarkAllRead}
                                    className="text-xs text-purple-400 hover:text-purple-300 flex items-center gap-1 px-2 py-1 rounded-lg hover:bg-white/5 transition-colors"
                                >
                                    <CheckCheck className="w-3 h-3" />
                                    All read
                                </button>
                            )}
                            <button
                                onClick={() => setOpen(false)}
                                className="p-1 rounded-lg hover:bg-white/10 transition-colors text-white/50 hover:text-white"
                            >
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    </div>

                    {/* List */}
                    <div className="max-h-[420px] overflow-y-auto">
                        {notifications.length === 0 ? (
                            <div className="flex flex-col items-center justify-center py-12 text-white/40">
                                <Bell className="w-10 h-10 mb-3 opacity-30" />
                                <p className="text-sm">No notifications yet</p>
                            </div>
                        ) : (
                            notifications.map(n => {
                                const cfg = typeConfig[n.type] || typeConfig.info;
                                const Icon = cfg.icon;
                                return (
                                    <button
                                        key={n.id}
                                        onClick={() => handleMarkRead(n.id)}
                                        className={`w-full text-left px-4 py-3 border-b border-white/5 hover:bg-white/5 transition-colors flex gap-3 ${!n.isRead ? "bg-white/[0.03]" : ""}`}
                                    >
                                        {/* Icon */}
                                        <div className={`flex-shrink-0 w-8 h-8 rounded-full ${cfg.bg} ${cfg.border} border flex items-center justify-center mt-0.5`}>
                                            <Icon className={`w-4 h-4 ${cfg.color}`} />
                                        </div>

                                        {/* Content */}
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-start justify-between gap-2">
                                                <p className={`text-sm font-medium leading-tight ${n.isRead ? "text-white/70" : "text-white"}`}>
                                                    {n.title}
                                                </p>
                                                {!n.isRead && (
                                                    <span className="flex-shrink-0 w-2 h-2 bg-purple-400 rounded-full mt-1" />
                                                )}
                                            </div>
                                            <p className="text-xs text-white/50 mt-0.5 leading-relaxed line-clamp-2">
                                                {n.message}
                                            </p>
                                            <p className="text-[10px] text-white/30 mt-1">
                                                {timeAgo(n.createdAt)}
                                            </p>
                                        </div>
                                    </button>
                                );
                            })
                        )}
                    </div>

                    {/* Footer */}
                    {notifications.length > 0 && (
                        <div className="px-4 py-2 border-t border-white/10 text-center">
                            <p className="text-[10px] text-white/30">
                                {notifications.length} notification{notifications.length !== 1 ? "s" : ""} total
                            </p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
