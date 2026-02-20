import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Input } from "@/components/ui/input";
import { ChevronLeft, Shield, Send, MessageSquare } from "lucide-react";
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
    const [newMessage, setNewMessage] = useState("");
    const [isSending, setIsSending] = useState(false);
    const messagesEndRef = useRef<HTMLDivElement>(null);

    const scrollToBottom = () => {
        messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
    };

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

    useEffect(() => {
        scrollToBottom();
    }, [messages]);

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

    const handleSend = async () => {
        if (!newMessage.trim() || !chatId || isSending) return;

        setIsSending(true);
        try {
            // Extract receiverId from chatId (support_{userId})
            const receiverIdStr = chatId.split('_')[1];
            if (!receiverIdStr) throw new Error("Invalid chat ID format");
            const receiverId = parseInt(receiverIdStr);

            const sentMsg = await sendMessage({
                receiver_id: receiverId,
                chat_id: chatId,
                content: newMessage.trim(),
                message_type: 'text'
            });

            // Optimistically update local messages if socket hasn't yet
            setMessages(prev => {
                if (prev.find(m => m.id === sentMsg.id)) return prev;
                return [...prev, sentMsg];
            });
            setNewMessage("");
        } catch (err) {
            toast({
                title: "Error",
                description: "Failed to send message",
                variant: "destructive"
            });
        } finally {
            setIsSending(false);
        }
    };

    if (isLoading) {
        return (
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">Loading chat history...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col max-h-screen overflow-hidden">
            {/* Header */}
            <header className="border-b border-border bg-card p-4 flex items-center gap-4 sticky top-0 z-10 shrink-0">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold text-card-foreground line-clamp-1">
                        Support Chat: {chatId}
                    </h1>
                </div>
            </header>

            {/* Message List */}
            <ScrollArea className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg) => {
                        const isSystem = msg.messageType === 'system';
                        const isMine = msg.senderId === user?.id;

                        return (
                            <div key={msg.id} className={`flex flex-col ${isSystem ? 'items-center' : (isMine ? 'items-end' : 'items-start')}`}>
                                {!isSystem && (
                                    <div className={`flex items-center gap-2 mb-2 ${isMine ? 'flex-row-reverse' : ''}`}>
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={(msg as any).sender?.avatarUrl} />
                                            <AvatarFallback>{(msg as any).sender?.displayName?.[0] || '?'}</AvatarFallback>
                                        </Avatar>
                                        <div className={`flex flex-col ${isMine ? 'items-end' : 'items-start'}`}>
                                            <span className="text-sm font-semibold text-foreground">{(msg as any).sender?.displayName || 'Unknown'}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(msg.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className={`p-4 rounded-2xl text-sm shadow-sm ${isSystem
                                    ? 'bg-secondary/40 text-muted-foreground text-xs italic border border-border px-6 text-center'
                                    : (isMine
                                        ? 'bg-primary text-primary-foreground rounded-tr-md max-w-[85%]'
                                        : 'bg-card text-card-foreground border border-border rounded-tl-md max-w-[85%]'
                                    )
                                    }`}>
                                    {msg.content}
                                    {msg.attachmentUrl && (
                                        <div className={`mt-3 p-3 rounded-xl border flex items-center gap-2 ${isMine ? 'bg-white/10 border-white/20' : 'bg-secondary/50 border-border'}`}>
                                            <span className="text-xl">📎</span>
                                            <div>
                                                <p className="text-xs font-medium">{msg.attachmentName || 'Attachment'}</p>
                                                <a
                                                    href={msg.attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className={`text-[10px] hover:underline ${isMine ? 'text-white/80' : 'text-primary'}`}
                                                >
                                                    View File
                                                </a>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })}
                    <div ref={messagesEndRef} />
                    {messages.length === 0 && (
                        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border mt-8">
                            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                            <p className="text-muted-foreground italic">No messages recorded in this conversation.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>

            {/* Input Footer */}
            <div className="p-4 border-t border-border bg-card shrink-0">
                <div className="max-w-3xl mx-auto flex items-center gap-2">
                    <Input
                        placeholder="Type a reply..."
                        value={newMessage}
                        onChange={(e) => setNewMessage(e.target.value)}
                        onKeyDown={(e) => e.key === "Enter" && handleSend()}
                        className="bg-secondary border-border"
                        disabled={isSending}
                    />
                    <Button
                        size="icon"
                        onClick={handleSend}
                        disabled={!newMessage.trim() || isSending}
                    >
                        <Send className="h-4 w-4" />
                    </Button>
                </div>
            </div>
        </div>
    );
};

export default AdminChatView;
