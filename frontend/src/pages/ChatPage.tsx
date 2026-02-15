import { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search, Send, Paperclip, Smile, ArrowLeft, Image, FileText,
  Mic, MoreVertical, DollarSign, User as UserIcon, Plus,
  Trash2, Ban, AlertTriangle, Download
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  getChatList, getMessages, sendMessage, markMessagesAsRead, uploadFile,
  searchUsers, blockUser, reportUser, clearChatHistory, getUser,
  Chat as ChatType, Message as MessageType, AuthUser
} from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { socketService } from "@/lib/socket";

function formatTime(ts: string) {
  return new Date(ts).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

const EMOJIS = ["😀", "😂", "🥰", "😍", "😊", "😎", "🤔", "😅", "🔥", "👍", "❤️", "🙌", "✨", "🎉", "💯", "🙏"];

const EmojiPicker = ({ onSelect }: { onSelect: (emoji: string) => void }) => (
  <PopoverContent className="w-64 p-2 bg-card border-border shadow-xl">
    <div className="grid grid-cols-4 gap-1">
      {EMOJIS.map((emoji) => (
        <button
          key={emoji}
          onClick={() => onSelect(emoji)}
          className="h-10 text-xl hover:bg-secondary rounded-lg transition-colors flex items-center justify-center"
        >
          {emoji}
        </button>
      ))}
    </div>
  </PopoverContent>
);

// Conversation list component moved outside to prevent remounting on state changes
const ConversationList = ({
  searchQuery,
  setSearchQuery,
  isSearching,
  searchResults,
  startChat,
  isLoading,
  filteredChats,
  selectedChat,
  setSelectedChat
}: {
  searchQuery: string;
  setSearchQuery: (val: string) => void;
  isSearching: boolean;
  searchResults: AuthUser[];
  startChat: (user: AuthUser) => void;
  isLoading: boolean;
  filteredChats: ChatType[];
  selectedChat: ChatType | null;
  setSelectedChat: (chat: ChatType | null) => void;
}) => (
  <div className="flex flex-col h-full bg-background overflow-hidden">
    {/* Header */}
    <div className="p-4 border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-md">
      <h1 className="text-xl font-bold text-foreground mb-3">Chats</h1>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          className="pl-9 bg-secondary border-border"
          placeholder="Search conversations or username..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
        />
      </div>
    </div>

    {/* Chat list */}
    <ScrollArea className="flex-1">
      {/* Show search results if searching for users */}
      {searchQuery.trim().length > 0 && (
        <>
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground mb-2">USERS</p>
            {isSearching ? (
              <div className="text-center text-muted-foreground py-4">Searching...</div>
            ) : searchResults.length === 0 ? (
              <div className="text-sm text-muted-foreground py-4">No users found</div>
            ) : (
              searchResults.map((foundUser) => (
                <button
                  key={foundUser.id}
                  onClick={() => startChat(foundUser)}
                  className="w-full flex items-center gap-3 p-3 hover:bg-secondary/60 transition-colors rounded-lg mb-2"
                >
                  <Avatar className="h-10 w-10">
                    <AvatarImage src={foundUser.avatarUrl} />
                    <AvatarFallback>{foundUser.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="font-medium text-foreground truncate">{foundUser.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{foundUser.username}</p>
                  </div>
                  <Plus className="h-4 w-4 text-muted-foreground" />
                </button>
              ))
            )}
          </div>
          <div className="p-4 border-b border-border">
            <p className="text-xs font-semibold text-muted-foreground">CONVERSATIONS</p>
          </div>
        </>
      )}

      {/* Show chats */}
      {isLoading ? (
        <div className="text-center text-muted-foreground py-8">Loading chats...</div>
      ) : filteredChats.length === 0 && searchQuery.trim().length === 0 ? (
        <div className="text-center text-muted-foreground py-8">
          <p>No conversations yet</p>
          <p className="text-xs mt-2">Search for a user to start chatting</p>
        </div>
      ) : (
        filteredChats.map((chat) => (
          <button
            key={chat.chat_id}
            onClick={() => setSelectedChat(chat)}
            className={`w-full flex items-center gap-3 p-4 hover:bg-secondary/60 transition-colors border-b border-border ${selectedChat?.chat_id === chat.chat_id ? "bg-secondary" : ""
              }`}
          >
            <div className="relative">
              <Avatar className="h-12 w-12">
                <AvatarImage src={chat.avatar_url} />
                <AvatarFallback className="bg-muted text-muted-foreground">
                  {chat.display_name[0]}
                </AvatarFallback>
              </Avatar>
            </div>
            <div className="flex-1 min-w-0 text-left">
              <div className="flex justify-between items-center">
                <span className="font-medium text-foreground truncate">{chat.display_name}</span>
                <span className="text-xs text-muted-foreground">
                  {chat.last_message_time ? formatTime(chat.last_message_time) : ""}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <p className="text-sm text-muted-foreground truncate">{chat.last_message}</p>
                {chat.unread_count > 0 && (
                  <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] flex items-center justify-center text-xs ml-2">
                    {chat.unread_count}
                  </Badge>
                )}
              </div>
            </div>
          </button>
        ))
      )}
    </ScrollArea>
  </div>
);

// Chat view component moved outside to prevent remounting
const ChatView = ({
  selectedChat,
  setSelectedChat,
  isMobile,
  navigate,
  user,
  messages,
  error,
  newMessage,
  setNewMessage,
  handleSend,
  messageInputRef,
  fileInputRef,
  handleFileSelect
}: {
  selectedChat: ChatType | null;
  setSelectedChat: (chat: ChatType | null) => void;
  isMobile: boolean;
  navigate: ReturnType<typeof useNavigate>;
  user: AuthUser | null;
  messages: MessageType[];
  error: string;
  newMessage: string;
  setNewMessage: (val: string) => void;
  handleSend: () => void;
  messageInputRef: React.RefObject<HTMLInputElement>;
  fileInputRef: React.RefObject<HTMLInputElement>;
  handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);
  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full items-center justify-center bg-background">
        <div className="text-center text-muted-foreground p-8">
          <div className="bg-secondary/30 h-24 w-24 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm">
            <Send className="h-10 w-10 text-primary opacity-40 -rotate-12" />
          </div>
          <h2 className="text-xl font-semibold text-foreground mb-2">Your Messages</h2>
          <p className="max-w-[240px] mx-auto text-sm">Select a conversation from the list to start chatting with your friends</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full bg-background overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur-md">
        {isMobile && (
          <button onClick={() => setSelectedChat(null)}>
            <ArrowLeft className="h-5 w-5 text-foreground" />
          </button>
        )}
        <Avatar className="h-10 w-10">
          <AvatarImage src={selectedChat.avatar_url} />
          <AvatarFallback>{selectedChat.display_name[0]}</AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground truncate">{selectedChat.display_name}</h3>
          <p className="text-xs text-muted-foreground">@{selectedChat.username}</p>
        </div>
        <div className="flex gap-1">
          <Button variant="ghost" size="icon" onClick={() => navigate(`/profile/${selectedChat.user_id}`)}>
            <UserIcon className="h-5 w-5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(`/escrow?chatId=${selectedChat.chat_id}&vendorId=${selectedChat.user_id}`)}
          >
            <DollarSign className="h-5 w-5 text-primary" />
          </Button>
          <ChatMoreMenu
            chatId={selectedChat.chat_id}
            userInfo={{ id: selectedChat.user_id, displayName: selectedChat.display_name }}
            onChatCleared={() => setSelectedChat(null)}
          />
        </div>
      </div>

      {/* Messages */}
      <ScrollArea className="flex-1 p-4">
        <div className="space-y-3">
          {messages.length === 0 ? (
            <div className="text-center text-muted-foreground py-8">Start a conversation</div>
          ) : (
            messages.map((msg) => {
              const isMine = msg.senderId === user?.id;
              return (
                <div key={msg.id} className={`flex ${isMine ? "justify-end" : "justify-start"}`}>
                  <div
                    className={`max-w-[75%] rounded-2xl px-4 py-2.5 ${isMine
                      ? "bg-primary text-primary-foreground rounded-br-md"
                      : "bg-secondary text-secondary-foreground rounded-bl-md"
                      }`}
                  >
                    <p className="text-sm">{msg.content}</p>
                    {msg.attachmentUrl && (
                      <div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2">
                        {msg.messageType === 'image' || msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                          <div
                            className="cursor-pointer hover:opacity-90 transition-opacity"
                            onClick={() => setPreviewImage(msg.attachmentUrl || null)}
                          >
                            <img src={msg.attachmentUrl} alt="attachment" className="max-w-full rounded h-48 object-cover shadow-sm border border-white/10" />
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileText className="h-5 w-5 shrink-0" />
                            <a
                              href={msg.attachmentUrl.includes('cloudinary.com')
                                ? msg.attachmentUrl.replace('/upload/', '/upload/fl_attachment/')
                                : msg.attachmentUrl}
                              download={msg.attachmentName || "download"}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs underline truncate hover:text-primary transition-colors flex items-center gap-1"
                            >
                              {msg.attachmentName || 'Download File'}
                              <Download className="h-3 w-3" />
                            </a>
                          </div>
                        )}
                      </div>
                    )}
                    <p
                      className={`text-[10px] mt-1 ${isMine ? "text-primary-foreground/70" : "text-muted-foreground"
                        }`}
                    >
                      {formatTime(msg.createdAt)}
                      {isMine && (msg.read ? " ✓✓" : " ✓")}
                    </p>
                  </div>
                </div>
              );
            })
          )}
          <div ref={messagesEndRef} />
        </div>
      </ScrollArea>

      {/* Image Preview Modal */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div className="relative group overflow-auto max-h-[90vh]">
            <img
              src={previewImage || ""}
              alt="Preview"
              className="max-w-full max-h-[85vh] h-auto object-contain rounded-lg shadow-2xl"
            />
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70 border-none text-white h-10 w-10 shadow-lg backdrop-blur-sm"
                onClick={() => setPreviewImage(null)}
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </Button>
              <a
                href={previewImage?.replace('/upload/', '/upload/fl_attachment/') || ""}
                download="download"
                className="flex items-center justify-center h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95"
              >
                <Download className="h-5 w-5" />
              </a>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Input */}
      <div className="p-3 border-t border-border">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 p-2 rounded mb-2">
            {error}
          </div>
        )}
        <div className="flex items-center gap-2">
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="ghost" size="icon" className="shrink-0">
                <Smile className="h-5 w-5 text-muted-foreground" />
              </Button>
            </PopoverTrigger>
            <EmojiPicker onSelect={(emoji) => setNewMessage(newMessage + emoji)} />
          </Popover>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept="image/*,.pdf,.doc,.docx,.txt,.zip,.rar"
          />
          <Button
            variant="ghost"
            size="icon"
            className="shrink-0"
            onClick={() => fileInputRef.current?.click()}
          >
            <Paperclip className="h-5 w-5 text-muted-foreground" />
          </Button>
          <Input
            ref={messageInputRef}
            className="bg-secondary border-border"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
          />
          <Button size="icon" onClick={handleSend} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
};

const ChatMoreMenu = ({
  chatId,
  userInfo,
  onChatCleared
}: {
  chatId: string;
  userInfo: { id: number, displayName: string };
  onChatCleared: () => void;
}) => {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isClearDialogOpen, setIsClearDialogOpen] = useState(false);
  const [isBlockDialogOpen, setIsBlockDialogOpen] = useState(false);
  const [isReportDialogOpen, setIsReportDialogOpen] = useState(false);
  const [reportReason, setReportReason] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleClearHistory = async () => {
    setIsLoading(true);
    try {
      await clearChatHistory(chatId);
      toast({ title: "History Cleared", description: "All messages in this chat have been deleted." });
      onChatCleared();
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to clear history", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsClearDialogOpen(false);
    }
  };

  const handleBlockUser = async () => {
    setIsLoading(true);
    try {
      await blockUser(userInfo.id);
      toast({ title: "User Blocked", description: `${userInfo.displayName} has been blocked.` });
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to block user", variant: "destructive" });
    } finally {
      setIsLoading(false);
      setIsBlockDialogOpen(false);
    }
  };

  const handleReportUser = async () => {
    if (!reportReason.trim()) return;
    setIsLoading(true);
    try {
      await reportUser(userInfo.id, reportReason);
      toast({ title: "Report Submitted", description: "Thank you for your report. We will investigate." });
      setReportReason("");
      setIsReportDialogOpen(false);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to submit report", variant: "destructive" });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="icon">
            <MoreVertical className="h-5 w-5" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48 bg-card border-border">
          <DropdownMenuItem onClick={() => setIsClearDialogOpen(true)} className="text-foreground">
            <Trash2 className="mr-2 h-4 w-4" /> Clear History
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setIsBlockDialogOpen(true)} className="text-destructive focus:text-destructive">
            <Ban className="mr-2 h-4 w-4" /> Block User
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => setIsReportDialogOpen(true)} className="text-foreground">
            <AlertTriangle className="mr-2 h-4 w-4" /> Report User
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      {/* Clear History Dialog */}
      <AlertDialog open={isClearDialogOpen} onOpenChange={setIsClearDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete all messages in this conversation for both participants. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearHistory} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? "Clearing..." : "Clear Everything"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Block User Dialog */}
      <AlertDialog open={isBlockDialogOpen} onOpenChange={setIsBlockDialogOpen}>
        <AlertDialogContent className="bg-card border-border">
          <AlertDialogHeader>
            <AlertDialogTitle>Block {userInfo.displayName}?</AlertDialogTitle>
            <AlertDialogDescription>
              They will no longer be able to send you messages. You can unblock them anytime from your settings.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleBlockUser} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {isLoading ? "Blocking..." : "Block User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Report User Dialog */}
      <Dialog open={isReportDialogOpen} onOpenChange={setIsReportDialogOpen}>
        <DialogContent className="bg-card border-border">
          <DialogHeader>
            <DialogTitle>Report User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to report {userInfo.displayName}? Please provide a reason below.
            </p>
            <Textarea
              placeholder="Reason for report (harassment, spam, etc.)..."
              value={reportReason}
              onChange={(e) => setReportReason(e.target.value)}
              className="bg-secondary border-border min-h-[100px]"
            />
            <div className="flex justify-end gap-2">
              <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)}>Cancel</Button>
              <Button onClick={handleReportUser} disabled={isLoading || !reportReason.trim()}>
                {isLoading ? "Submitting..." : "Submit Report"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
};

const ChatPage = () => {
  const isMobile = useIsMobile();
  const navigate = useNavigate();
  const { user, isLoading: authLoading } = useAuth();

  const [chats, setChats] = useState<ChatType[]>([]);
  const [messages, setMessages] = useState<MessageType[]>([]);
  const [selectedChat, setSelectedChat] = useState<ChatType | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AuthUser[]>([]);
  const [newMessage, setNewMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [error, setError] = useState("");
  const messageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);


  const loadChats = useCallback(async () => {
    setIsLoading(true);
    try {
      const data = await getChatList();
      setChats(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load chats");
    } finally {
      setIsLoading(false);
    }
  }, []);

  const loadMessages = useCallback(async (chatId: string) => {
    try {
      const data = await getMessages(chatId);
      setMessages(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load messages");
    }
  }, []);

  const startChat = useCallback((foundUser: AuthUser) => {
    // Create a new chat object for the user
    const newChat: ChatType = {
      chat_id: `chat_${user?.id}_${foundUser.id}_${Date.now()}`,
      last_message: "New conversation",
      last_message_time: new Date().toISOString(),
      user_id: foundUser.id,
      display_name: foundUser.displayName,
      avatar_url: foundUser.avatarUrl,
      username: foundUser.username,
      unread_count: 0,
    };

    setSelectedChat(newChat);
    setSearchQuery("");
    setSearchResults([]);
    setMessages([]);
  }, [user?.id]);

  const handleSearch = useCallback(async (query = searchQuery) => {
    if (query.trim().length < 2) {
      setSearchResults([]);
      return;
    }

    setIsSearching(true);
    try {
      const results = await searchUsers(query);
      setSearchResults(results);
      return results;
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to search users");
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, [searchQuery]);

  // Handle automatic chat selection from query params
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const targetUserId = params.get('userId');

    if (targetUserId && user && chats.length > 0) {
      const targetIdNum = parseInt(targetUserId);
      if (targetIdNum === user.id) return; // Can't chat with self

      // 1. Check if chat already exists
      const existingChat = chats.find(c => c.user_id === targetIdNum);
      if (existingChat) {
        setSelectedChat(existingChat);
        // Clear param to avoid re-triggering if user navigates back to list
        window.history.replaceState({}, '', '/chat');
      } else {
        // 2. If not, fetch user and start new chat
        const fetchAndStartChat = async () => {
          try {
            const targetUser = await getUser(targetIdNum);
            startChat(targetUser);
            window.history.replaceState({}, '', '/chat');
          } catch (err) {
            console.error("Failed to start chat from query param:", err);
          }
        };
        fetchAndStartChat();
      }
    }
  }, [user, chats, startChat]);

  // Load chats on mount and when user changes
  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login");
      return;
    }
    if (user) {
      loadChats();
      socketService.connect(user.id);
    }
    return () => {
      socketService.disconnect();
    };
  }, [user, authLoading, navigate, loadChats]);

  // Handle real-time messages
  useEffect(() => {
    if (!user) return;

    const cleanup = socketService.onNewMessage((msg: MessageType) => {
      // If message is for the current open chat, add it to messages list
      if (selectedChat && msg.chatId === selectedChat.chat_id) {
        setMessages((prev) => {
          // Prevent duplicates
          if (prev.find((m) => m.id === msg.id)) return prev;
          return [...prev, msg];
        });
        // Mark as read if we are looking at this chat
        if (msg.senderId !== user.id) {
          markMessagesAsRead(selectedChat.chat_id).then(() => loadChats());
        }
      } else {
        // Always refresh chat list to show latest message/unread count
        loadChats();
      }
    });

    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Handle messages being read
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessagesRead((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) => (m.receiverId === data.readerId ? { ...m, read: true } : m))
        );
      }
    });
    return cleanup;
  }, [user, selectedChat]);

  // Load messages and join room when selected chat changes
  useEffect(() => {
    if (selectedChat && user) {
      loadMessages(selectedChat.chat_id);
      socketService.joinChat(user.id, selectedChat.chat_id);
      // Mark as read when opening chat
      markMessagesAsRead(selectedChat.chat_id).then(() => loadChats());
    }
  }, [selectedChat?.chat_id, user, loadMessages, loadChats]);

  // Search users when query changes - debounce to avoid excessive searching
  useEffect(() => {
    const timer = setTimeout(() => {
      handleSearch();
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery, handleSearch]);


  const handleSend = useCallback(async () => {
    if (!newMessage.trim() || !selectedChat || !user) return;

    const messageToSend = newMessage;
    setNewMessage("");

    try {
      await sendMessage({
        receiver_id: selectedChat.user_id,
        chat_id: selectedChat.chat_id,
        content: messageToSend,
        message_type: "text",
      });
      await loadMessages(selectedChat.chat_id);
      await loadChats();

      // Refocus input after sending
      if (messageInputRef.current) {
        messageInputRef.current.focus();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setNewMessage(messageToSend);
    }
  }, [newMessage, selectedChat, user, loadMessages, loadChats]);

  const handleFileSelect = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !user) return;

    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      setError("File is too large. Max size is 500MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsLoading(true);
    try {
      await uploadFile({
        receiver_id: selectedChat.user_id,
        chat_id: selectedChat.chat_id,
        file: file,
        content: `Sent a file: ${file.name}`
      });
      await loadMessages(selectedChat.chat_id);
      await loadChats();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
      // Reset file input
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }, [selectedChat, user, loadMessages, loadChats]);

  const filteredChats = chats.filter((c) =>
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Mobile: show one panel at a time
  if (isMobile) {
    return (
      <div className="h-[calc(100vh-64px)] overflow-hidden">
        {selectedChat ? (
          <ChatView
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
            isMobile={isMobile}
            navigate={navigate}
            user={user}
            messages={messages}
            error={error}
            newMessage={newMessage}
            setNewMessage={setNewMessage}
            handleSend={handleSend}
            messageInputRef={messageInputRef}
            fileInputRef={fileInputRef}
            handleFileSelect={handleFileSelect}
          />
        ) : (
          <ConversationList
            searchQuery={searchQuery}
            setSearchQuery={setSearchQuery}
            isSearching={isSearching}
            searchResults={searchResults}
            startChat={startChat}
            isLoading={isLoading}
            filteredChats={filteredChats}
            selectedChat={selectedChat}
            setSelectedChat={setSelectedChat}
          />
        )}
      </div>
    );
  }

  // Desktop: side-by-side
  return (
    <div className="flex h-[calc(100vh-64px)] overflow-hidden">
      <div className="w-80 border-r border-border shrink-0 h-full overflow-hidden">
        <ConversationList
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          isSearching={isSearching}
          searchResults={searchResults}
          startChat={startChat}
          isLoading={isLoading}
          filteredChats={filteredChats}
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
        />
      </div>
      <div className="flex-1 h-full overflow-hidden">
        <ChatView
          selectedChat={selectedChat}
          setSelectedChat={setSelectedChat}
          isMobile={isMobile}
          navigate={navigate}
          user={user}
          messages={messages}
          error={error}
          newMessage={newMessage}
          setNewMessage={setNewMessage}
          handleSend={handleSend}
          messageInputRef={messageInputRef}
          fileInputRef={fileInputRef}
          handleFileSelect={handleFileSelect}
        />
      </div>
    </div>
  );
};

export default ChatPage;
