import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronLeft, Shield, Send, MessageSquare, Loader2, Eye, Ban, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminChatMessages, sendMessage, Message as MessageType } from "@/lib/api";
import { socketService } from "@/lib/socket";

const AdminChatView = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { toast } = useToast();
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<MessageType[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = (behavior: ScrollBehavior = "smooth") => {
        messagesEndRef.current?.scrollIntoView({ behavior });
    };

    // Auto-scroll logic for new messages
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            const container = scrollRef.current;
            if (container) {
                // If user is already at the bottom (within 100px), scroll to new message
                const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150;
                if (isNearBottom) {
                    scrollToBottom("smooth");
                }
            }
        }
    }, [messages, isLoading]);

    // Initial scroll
    useEffect(() => {
        if (!isLoading && messages.length > 0) {
            setTimeout(() => scrollToBottom("auto"), 100);
        }
    }, [isLoading]);

    useEffect(() => {
        if (!user && !authLoading) {
            navigate("/login");
            return;
        }
        if (user && user.role !== "admin") {
            toast({
                title: "Access Denied",
                description: "You don't have permission to access the admin panel",
                variant: "destructive"
            });
            navigate("/chat");
            return;
        }
        if (chatId) {
            loadMessages();

            // Join the chat room for real-time updates
            socketService.joinChat(user.id, chatId);

            const handleNewMessage = (msg: MessageType) => {
                if (msg.chatId === chatId) {
                    setMessages(prev => {
                        if (prev.find(m => m.id === msg.id)) return prev;
                        return [...prev, msg];
                    });
                }
            };

            const cleanup = socketService.onNewMessage(handleNewMessage);

            return () => {
                if (cleanup) cleanup();
            };
        }
    }, [user, authLoading, chatId, navigate]);

    const loadMessages = async () => {
        setIsLoading(true);
        try {
            if (!chatId) return;
            const msgs = await getAdminChatMessages(chatId);
            setMessages(msgs);
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to load chat messages",
                variant: "destructive"
            });
        } finally {
            setIsLoading(false);
        }
    };

    if (isLoading) {
        return (
            <div className="h-screen bg-background flex items-center justify-center">
                <div className="flex flex-col items-center gap-4">
                    <Loader2 className="h-8 w-8 text-primary animate-spin" />
                    <p className="text-muted-foreground animate-pulse text-sm">Synchronizing history...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="h-screen bg-background flex flex-col overflow-hidden">
            {/* Header */}
            <header className="border-b border-border bg-card/80 backdrop-blur-md p-4 flex items-center justify-between sticky top-0 z-20 shrink-0 shadow-sm">
                <div className="flex items-center gap-4">
                    <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="rounded-full hover:bg-secondary">
                        <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <div className="flex items-center gap-3">
                        <div className="bg-primary/10 p-2 rounded-xl border border-primary/20">
                            <Shield className="h-5 w-5 text-primary" />
                        </div>
                        <div className="flex flex-col">
                            <h1 className="text-sm font-bold text-card-foreground leading-tight">
                                Live Monitoring
                            </h1>
                            <div className="flex items-center gap-1.5 overflow-hidden">
                                <span className="h-1.5 w-1.5 rounded-full bg-green-500 animate-pulse shrink-0" />
                                <p className="text-[10px] text-muted-foreground font-mono truncate max-w-[150px]">{chatId}</p>
                            </div>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-3">
                    <div className="hidden md:flex bg-secondary/50 border border-border px-3 py-1 rounded-full items-center gap-2">
                        <Eye className="h-3 w-3 text-muted-foreground" />
                        <span className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">Observer</span>
                    </div>
                    <div className="bg-amber-500/10 text-amber-600 dark:text-amber-400 text-[10px] font-black px-3 py-1.5 rounded-lg border border-amber-500/20 shadow-inner flex items-center gap-2">
                        <Ban className="h-3 w-3" />
                        READ ONLY
                    </div>
                </div>
            </header>

            {/* Message List */}
            <div
                ref={scrollRef}
                className="flex-1 overflow-y-auto bg-dot-pattern scroll-smooth"
            >
                <div className="max-w-3xl mx-auto p-4 md:p-8 space-y-8 min-h-full flex flex-col">
                    <div className="flex-1 space-y-8">
                        {messages.map((msg, index) => {
                            const isSystem = msg.messageType === 'system';
                            const isSender = (msg as any).sender?.role === 'admin';

                            // Check if date changed to show day separator
                            const showDateSeparator = index === 0 ||
                                new Date(messages[index - 1].createdAt).toDateString() !== new Date(msg.createdAt).toDateString();

                            return (
                                <div key={msg.id} className="space-y-4">
                                    {showDateSeparator && (
                                        <div className="flex justify-center my-8">
                                            <span className="bg-secondary/50 text-muted-foreground text-[10px] font-bold px-3 py-1 rounded-full border border-border">
                                                {new Date(msg.createdAt).toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
                                            </span>
                                        </div>
                                    )}
                                    <div className={`flex flex-col ${isSystem ? 'items-center' : (isSender ? 'items-end' : 'items-start')}`}>
                                        {!isSystem && (
                                            <div className={`flex items-center gap-2 mb-2 ${isSender ? 'flex-row-reverse' : ''}`}>
                                                <Avatar className="h-9 w-9 border-2 border-background shadow-md">
                                                    <AvatarImage src={(msg as any).sender?.avatarUrl} />
                                                    <AvatarFallback className="bg-gradient-to-br from-primary/20 to-secondary text-primary text-xs font-bold">
                                                        {(msg as any).sender?.displayName?.[0] || '?'}
                                                    </AvatarFallback>
                                                </Avatar>
                                                <div className={`flex flex-col ${isSender ? 'items-end' : 'items-start'}`}>
                                                    <div className="flex items-center gap-1.5">
                                                        <span className="text-xs font-bold text-foreground">
                                                            {(msg as any).sender?.displayName || 'User'}
                                                        </span>
                                                        {(msg as any).sender?.role === 'admin' && <Badge variant="secondary" className="h-3 px-1 text-[8px] uppercase">Admin</Badge>}
                                                    </div>
                                                    <span className="text-[9px] text-muted-foreground font-medium">
                                                        {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                                    </span>
                                                </div>
                                            </div>
                                        )}
                                        <div className={`group relative p-4 rounded-2xl text-sm shadow-sm transition-all border ${isSystem
                                            ? 'bg-secondary/40 text-muted-foreground text-[11px] italic border-border px-8 text-center rounded-lg'
                                            : (isSender
                                                ? 'bg-primary text-primary-foreground rounded-tr-none max-w-[85%] border-primary/20 hover:shadow-md'
                                                : 'bg-card text-card-foreground border-border rounded-tl-none max-w-[85%] hover:shadow-md'
                                            )
                                            }`}>
                                            <p className="whitespace-pre-wrap break-words leading-relaxed">{msg.content}</p>

                                            {msg.attachmentUrl && (
                                                <div className={`mt-4 p-4 rounded-xl border flex items-center gap-3 ${isSender ? 'bg-white/10 border-white/20' : 'bg-secondary/30 border-border/50'}`}>
                                                    <div className={`p-2 rounded-lg ${isSender ? 'bg-white/10' : 'bg-primary/10'}`}>
                                                        <span className="text-lg">📎</span>
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="text-xs font-bold truncate mb-1">{msg.attachmentName || 'Attachment'}</p>
                                                        <a
                                                            href={msg.attachmentUrl}
                                                            target="_blank"
                                                            rel="noopener noreferrer"
                                                            className={`inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-tighter hover:opacity-80 transition-opacity ${isSender ? 'text-white' : 'text-primary'}`}
                                                        >
                                                            Download File
                                                            <ChevronRight className="h-2 w-2" />
                                                        </a>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Subtle timestamp on hover for non-system messages */}
                                            {!isSystem && (
                                                <span className={`absolute -bottom-5 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] font-mono text-muted-foreground whitespace-nowrap ${isSender ? 'right-0' : 'left-0'}`}>
                                                    Message ID: {msg.id}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                        <div ref={messagesEndRef} className="h-4" />
                    </div>
                </div>
            </div>

            {/* Bottom Monitoring Footer */}
            <footer className="bg-card/90 backdrop-blur-md border-t border-border p-4 shrink-0 flex flex-col md:flex-row items-center justify-between gap-3 shadow-[0_-4px_12px_rgba(0,0,0,0.05)]">
                <div className="flex items-center gap-3">
                    <div className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                    <span className="text-[11px] font-bold text-muted-foreground uppercase tracking-widest">Live Monitoring Active</span>
                </div>
                <div className="flex items-center gap-3 py-1 px-4 bg-secondary/50 rounded-full border border-border">
                    <Shield className="h-3 w-3 text-primary" />
                    <p className="text-[10px] text-muted-foreground font-medium italic">
                        All actions are logged. Admin is in Restricted Observer Mode.
                    </p>
                </div>
                <div className="hidden md:block">
                    <p className="text-[9px] text-muted-foreground/60 font-mono">SEC-ID: {user?.id}-OBS</p>
                </div>
            </footer>
        </div>
    );
};

export default AdminChatView;
