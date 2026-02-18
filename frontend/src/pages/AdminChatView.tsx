import { useState, useEffect } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ChevronLeft, Shield } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/contexts/AuthContext";
import { getAdminChatMessages } from "@/lib/api";

const AdminChatView = () => {
    const { chatId } = useParams<{ chatId: string }>();
    const { toast } = useToast();
    const { user, isLoading: authLoading } = useAuth();
    const navigate = useNavigate();

    const [messages, setMessages] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(true);

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
            <div className="min-h-screen bg-background flex items-center justify-center">
                <p className="text-muted-foreground">Loading chat history...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background flex flex-col">
            {/* Header */}
            <header className="border-b border-border bg-card p-4 flex items-center gap-4 sticky top-0 z-10">
                <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
                    <ChevronLeft className="h-5 w-5" />
                </Button>
                <div className="flex items-center gap-2">
                    <Shield className="h-5 w-5 text-primary" />
                    <h1 className="text-lg font-bold text-card-foreground line-clamp-1">
                        Admin Chat Log: {chatId}
                    </h1>
                </div>
            </header>

            {/* Message List */}
            <ScrollArea className="flex-1 p-4 md:p-8">
                <div className="max-w-3xl mx-auto space-y-6">
                    {messages.map((msg) => {
                        const isSystem = msg.messageType === 'system';
                        return (
                            <div key={msg.id} className={`flex flex-col ${isSystem ? 'items-center' : ''}`}>
                                {!isSystem && (
                                    <div className="flex items-center gap-2 mb-2">
                                        <Avatar className="h-8 w-8">
                                            <AvatarImage src={msg.sender.avatarUrl} />
                                            <AvatarFallback>{msg.sender.displayName[0]}</AvatarFallback>
                                        </Avatar>
                                        <div className="flex flex-col">
                                            <span className="text-sm font-semibold text-foreground">{msg.sender.displayName}</span>
                                            <span className="text-[10px] text-muted-foreground">
                                                {new Date(msg.createdAt).toLocaleString()}
                                            </span>
                                        </div>
                                    </div>
                                )}
                                <div className={`p-4 rounded-2xl text-sm shadow-sm ${isSystem
                                    ? 'bg-secondary/40 text-muted-foreground text-xs italic border border-border px-6'
                                    : 'bg-card text-card-foreground border border-border max-w-[85%]'
                                    }`}>
                                    {msg.isViewOnce && (
                                        <div className="flex items-center gap-1.5 text-[10px] font-bold text-primary mb-1 uppercase tracking-wider">
                                            <span className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />
                                            View Once Message {msg.isOpened && "(Opened)"}
                                        </div>
                                    )}
                                    {msg.content}
                                    {msg.attachmentUrl && (
                                        <div className="mt-3 p-3 bg-secondary/50 rounded-xl border border-border flex items-center gap-2">
                                            <span className="text-xl">📎</span>
                                            <div>
                                                <p className="text-xs font-medium text-foreground">{msg.attachmentName || 'Attachment'}</p>
                                                <a
                                                    href={msg.attachmentUrl}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="text-[10px] text-primary hover:underline"
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
                    {messages.length === 0 && (
                        <div className="text-center py-20 bg-card rounded-2xl border border-dashed border-border">
                            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-3 opacity-20" />
                            <p className="text-muted-foreground italic">No messages recorded in this conversation.</p>
                        </div>
                    )}
                </div>
            </ScrollArea>
        </div>
    );
};

export default AdminChatView;
import { MessageSquare } from "lucide-react";
