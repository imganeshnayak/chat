import React, { useState, useEffect, useCallback, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";
import {
  Search, Send, Paperclip, Smile, ArrowLeft, Image, FileText,
  Mic, MoreVertical, IndianRupee, User as UserIcon, Plus,
  Trash2, Ban, AlertTriangle, Download, X, CheckCircle2, Loader2, LogOut, Settings, User, HelpCircle, ShieldCheck, EyeOff, Eye, Lock, Shield, Camera, Film
} from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { useScreenshotProtection } from "@/hooks/useScreenshotProtection";
import { useMobileScreenshotProtection } from "@/hooks/useMobileScreenshotProtection";
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
  deleteMessage, deleteMessagesBatch, getSupportChat, openViewOnceMessage,
  Chat as ChatType, Message as MessageType, AuthUser
} from "@/lib/api";
import { useIsMobile } from "@/hooks/use-mobile";
import { socketService } from "@/lib/socket";
import { getCloudinaryDownloadUrl, downloadFile } from "@/lib/cloudinary";
import LoadingScreen from "@/components/ui/LoadingScreen";
import { detectDevice, applyPlatformSpecificProtections } from "@/lib/mobileProtectionService";
import { createScreenshotNotification } from "@/lib/screenshotNotification";
import { notifyScreenshotAttempt } from "@/lib/api";
import FilePreviewDialog from "@/components/chat/FilePreviewDialog";
import NotificationBell from "@/components/NotificationBell";

function formatTime(ts: string) {
  const now = new Date();
  const time = new Date(ts);
  const diff = now.getTime() - time.getTime();
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days}d ago`;

  // For older messages, show as date
  return time.toLocaleDateString([], { month: "short", day: "numeric" });
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
  setSelectedChat,
  user,
  onLogout,
  onSupport
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
  user: AuthUser | null;
  onLogout: () => void;
  onSupport: () => void;
}) => (
  <div className="flex flex-col h-full min-h-0 bg-background overflow-hidden">
    {/* Header */}
    <div className="p-4 border-b border-border sticky top-0 z-10 bg-background/95 backdrop-blur-md">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-xl font-bold text-foreground">Chats</h1>
        {user && (
          <div className="flex items-center gap-1">
            <NotificationBell />
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="rounded-full h-8 w-8 p-0 overflow-hidden border border-border">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56 bg-card border-border">
                <div className="flex items-center gap-2 p-2 px-3 border-b border-border mb-1">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl} />
                    <AvatarFallback>{user.displayName[0]}</AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.displayName}</p>
                    <p className="text-xs text-muted-foreground truncate">@{user.username}</p>
                  </div>
                </div>
                <DropdownMenuItem onClick={() => window.location.href = '/profile'}>
                  <User className="mr-2 h-4 w-4" /> Profile
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/wallet'}>
                  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="mr-2 h-4 w-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a2.25 2.25 0 00-2.25-2.25H15a3 3 0 11-6 0H5.25A2.25 2.25 0 003 12m18 0v6a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 18v-6m18 0V9M3 12V9m18 0a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 9m18 0V6a2.25 2.25 0 00-2.25-2.25H5.25A2.25 2.25 0 003 6v3" />
                  </svg>
                  Wallet
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => window.location.href = '/settings'}>
                  <Settings className="mr-2 h-4 w-4" /> Settings
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={onLogout} className="text-destructive focus:text-destructive">
                  <LogOut className="mr-2 h-4 w-4" /> Logout
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        )}
      </div>
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
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-medium text-foreground truncate">{chat.display_name}</span>
                  {chat.isOfficial ? (
                    <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] h-4 px-1.5 border-none flex items-center gap-0.5 flex-shrink-0">
                      <ShieldCheck className="h-3 w-3" />
                      OFFICIAL
                    </Badge>
                  ) : chat.chat_id.startsWith('support_') ? (
                    <Badge variant="secondary" className="bg-indigo-100/80 text-indigo-700 text-[10px] h-4 px-1.5 border-none flex items-center gap-0.5 flex-shrink-0 dark:bg-indigo-900/30 dark:text-indigo-400">
                      <HelpCircle className="h-3 w-3" />
                      SUPPORT
                    </Badge>
                  ) : chat.verified && (
                    <img src="/verified-badge.svg" alt="Verified" className="h-5 w-5 flex-shrink-0" />
                  )}
                </div>
                <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0">
                  {chat.last_message_time ? formatTime(chat.last_message_time) : ""}
                </span>
              </div>
              <div className="flex justify-between items-center gap-2">
                <p className="text-sm text-muted-foreground truncate flex-1">{chat.last_message}</p>
                {chat.unread_count > 0 && (
                  <Badge className="bg-primary text-primary-foreground h-5 min-w-[20px] flex items-center justify-center text-xs flex-shrink-0">
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
  handleFileSelect,
  onMessageDeleted,
  selectedMessages,
  setSelectedMessages,
  onDeleteMessagesBatch,
  pendingFile,
  setPendingFile,
  handleConfirmUpload,
  isLoading,
  isBlurred,
  setIsBlurred,
  isPreviewViewOnce,
  setIsPreviewViewOnce,
  currentAcceptType,
  setCurrentAcceptType
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
  onMessageDeleted: (messageId: number) => void;
  selectedMessages: number[];
  setSelectedMessages: (ids: number[]) => void;
  onDeleteMessagesBatch: (ids: number[]) => void;
  pendingFile: File | null;
  setPendingFile: (file: File | null) => void;
  handleConfirmUpload: (caption: string, viewOnce: boolean) => void;
  isLoading: boolean;
  isBlurred: boolean;
  setIsBlurred: (val: boolean) => void;
  isPreviewViewOnce: boolean;
  setIsPreviewViewOnce: (val: boolean) => void;
  currentAcceptType: string;
  setCurrentAcceptType: (val: string) => void;
}) => {
  const [isHoldingView, setIsHoldingView] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const isSelectionMode = selectedMessages.length > 0;

  const toggleMessageSelection = (messageId: number) => {
    if (selectedMessages.includes(messageId)) {
      setSelectedMessages(selectedMessages.filter(id => id !== messageId));
    } else {
      setSelectedMessages([...selectedMessages, messageId]);
    }
  };

  const handleMessageClick = (msg: MessageType) => {
    if (isSelectionMode) {
      toggleMessageSelection(msg.id);
    }
  };

  const longPressTimerRef = useRef<NodeJS.Timeout | null>(null);

  const onTouchStart = (messageId: number) => {
    if (!isMobile) return;
    // Clear any existing timer just in case
    if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);

    longPressTimerRef.current = setTimeout(() => {
      toggleMessageSelection(messageId);
      longPressTimerRef.current = null;
    }, 500);
  };

  const onTouchEnd = () => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const scrollingRef = useRef(false);

  useEffect(() => {
    if (messages.length > 0 && selectedChat) {
      // Use auto for chat switch, smooth for new messages
      const behavior = scrollingRef.current ? "smooth" : "auto";
      messagesEndRef.current?.scrollIntoView({ behavior });
      scrollingRef.current = true;
    } else {
      scrollingRef.current = false;
    }
  }, [messages.length, selectedChat?.chat_id]);

  const handleOpenViewOnce = async (msg: MessageType) => {
    if (msg.senderId === user?.id) return; // Don't handle opening for sender (local only)
    try {
      await openViewOnceMessage(msg.id);
    } catch (err) {
      console.error("Failed to open view-once message:", err);
    }
  };
  if (!selectedChat) {
    return (
      <div className="flex flex-col h-full min-h-0 items-center justify-center bg-background">
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
    <div className={`flex flex-col h-full min-h-0 bg-background relative overflow-hidden ${isBlurred ? 'blur-privacy' : ''}`} data-nocontext>
      {/* Privacy Screen Overlay - Only show when blurred and selected chat exists */}
      {isBlurred && selectedChat && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/70 backdrop-blur-xl animate-in fade-in duration-200 pointer-events-auto">
          <div className="text-center p-6 scale-in-95 animate-in duration-300">
            <div className="bg-destructive/10 p-4 rounded-full w-20 h-20 flex items-center justify-center mx-auto mb-4 border 2px border-destructive/30 shadow-lg">
              <Shield className="h-10 w-10 text-destructive animate-pulse" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-3 tracking-tight">Screenshot Detected</h2>
            <p className="text-sm text-muted-foreground mb-2">Unauthorized screen capture attempt blocked.</p>
            <p className="text-xs text-muted-foreground opacity-70">Your chat privacy is protected.</p>
          </div>
        </div>
      )}

      {/* Chat header */}
      <div className="flex items-center gap-3 p-4 border-b border-border sticky top-0 z-20 bg-background/95 backdrop-blur-md min-h-[73px]">
        {isSelectionMode ? (
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSelectedMessages([])}
                className="p-1 hover:bg-secondary rounded-full transition-colors"
              >
                <X className="h-6 w-6 text-foreground" />
              </button>
              <h3 className="font-semibold text-lg">{selectedMessages.length}</h3>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => onDeleteMessagesBatch(selectedMessages)}
                className="text-destructive hover:text-destructive hover:bg-destructive/10"
              >
                <Trash2 className="h-5 w-5" />
              </Button>
            </div>
          </div>
        ) : (
          <>
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
              <div className="flex items-center gap-1.5">
                <h3 className="font-semibold text-foreground truncate">{selectedChat.display_name}</h3>
                {selectedChat.isOfficial ? (
                  <Badge variant="secondary" className="bg-primary/10 text-primary text-[10px] px-1.5 border-none flex items-center gap-0.5">
                    <ShieldCheck className="h-3.5 w-3.5" />
                    OFFICIAL
                  </Badge>
                ) : selectedChat.verified && (
                  <img src="/verified-badge.svg" alt="Verified" className="h-7 w-7 flex-shrink-0" title="Verified Account" />
                )}
              </div>
              <p className="text-xs text-muted-foreground">
                {selectedChat.isOfficial ? "Official Support Channel" : `@${selectedChat.username}`}
              </p>
            </div>
            <div className="flex gap-1">
              <Button variant="ghost" size="icon" onClick={() => navigate(`/profile/${selectedChat.username}`)}>
                <UserIcon className="h-5 w-5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => navigate(`/escrow?chatId=${selectedChat.chat_id}&vendorId=${selectedChat.user_id}&vendorUsername=${selectedChat.username}`)}
                title="Escrow"
              >
                <span className="text-lg font-bold text-primary">₹</span>
              </Button>
              <ChatMoreMenu
                chatId={selectedChat.chat_id}
                userInfo={{ id: selectedChat.user_id, displayName: selectedChat.display_name }}
                onChatCleared={() => setSelectedChat(null)}
              />
            </div>
          </>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 relative overflow-hidden min-h-0 bg-background" data-nocontext>

        <div
          className="h-full overflow-y-auto scrollbar-thin scrollbar-thumb-primary/20 scroll-smooth relative z-10"
          data-nocontext
        >
          <div
            className="px-4 pt-4 pb-2 space-y-1 chat-message-container privacy-protected"
            style={{
              marginBottom: (typeof window !== 'undefined' && window.innerWidth <= 600) ? 50 : undefined
            }}
          >
            {messages.length === 0 ? (
              <div className="text-center text-muted-foreground py-8">Start a conversation</div>
            ) : (
              messages.map((msg, index) => {
                const isMine = msg.senderId === user?.id;
                const isAdminMsg = selectedChat?.isOfficial && (!isMine || user?.role === 'admin');
                const isEscrowOrNotify = msg.messageType?.startsWith?.('escrow_') || (msg as any).message_type?.startsWith?.('escrow_') || msg.messageType === 'notification' || (msg as any).message_type === 'notification' || isAdminMsg;

                // Date separator logic
                const currentDate = new Date(msg.createdAt).toDateString();
                const previousDate = index > 0 ? new Date(messages[index - 1].createdAt).toDateString() : null;
                const showDateSeparator = currentDate !== previousDate;

                return (
                  <React.Fragment key={msg.id}>
                    {showDateSeparator && (
                      <div className="flex justify-center my-6">
                        <span className="bg-secondary/60 text-secondary-foreground text-[11px] font-bold px-3 py-1.5 rounded-full border border-border/50 uppercase tracking-tighter shadow-sm backdrop-blur-sm">
                          {new Date(msg.createdAt).toLocaleDateString(undefined, {
                            weekday: 'long',
                            month: 'short',
                            day: 'numeric'
                          })}
                        </span>
                      </div>
                    )}
                    <div
                      className={`flex ${isMine ? "justify-end" : "justify-start"} items-center gap-2 group relative chat-message privacy-protected ${selectedMessages.includes(msg.id) ? "bg-primary/10 -mx-4 px-4 py-1" : ""}`}
                      onClick={() => handleMessageClick(msg)}
                      onTouchStart={() => onTouchStart(msg.id)}
                      onTouchEnd={onTouchEnd}
                      onContextMenu={(e) => {
                        e.preventDefault();
                        if (isMobile) {
                          toggleMessageSelection(msg.id);
                        }
                      }}
                      data-nocontext
                    >
                      {isSelectionMode && (
                        <div className={`absolute ${isMine ? "left-2" : "right-2"} z-10`}>
                          <div className={`h-5 w-5 rounded-full border-2 ${selectedMessages.includes(msg.id) ? "bg-primary border-primary flex items-center justify-center" : "border-muted-foreground"}`}>
                            {selectedMessages.includes(msg.id) && <CheckCircle2 className="h-3 w-3 text-primary-foreground" />}
                          </div>
                        </div>
                      )}
                      {!msg.isDeleted && !isSelectionMode && !isMobile && (
                        <div className={`opacity-0 group-hover:opacity-100 transition-opacity ${isMine ? "order-first" : "order-last"}`}>
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-8 w-8 rounded-full hover:bg-secondary">
                                <MoreVertical className="h-4 w-4 text-muted-foreground" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align={isMine ? "end" : "start"} className="w-32 bg-card border-border">
                              {isMine && (
                                <DropdownMenuItem
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    onMessageDeleted(msg.id);
                                  }}
                                  className="text-destructive focus:text-destructive"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" /> Delete
                                </DropdownMenuItem>
                              )}
                              <DropdownMenuItem
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleMessageSelection(msg.id);
                                }}
                              >
                                <CheckCircle2 className="mr-2 h-4 w-4" /> Select
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </div>
                      )}
                      <div
                        className={`max-w-[85%] rounded-2xl px-4 py-3 relative privacy-protected ${isMine
                          ? (isEscrowOrNotify ? "" : "bg-primary text-primary-foreground rounded-br-md")
                          : (isEscrowOrNotify ? "" : "bg-secondary text-secondary-foreground rounded-bl-md")
                          } ${msg.isDeleted ? "opacity-60 italic" : ""} ${isEscrowOrNotify ? (
                            (msg.messageType === 'escrow_released' || (msg as any).message_type === 'escrow_released')
                              ? "bg-gradient-to-br from-emerald-600 to-teal-700 text-white shadow-lg border border-white/20 rounded-2xl"
                              : (msg.messageType === 'notification' || (msg as any).message_type === 'notification' || isAdminMsg)
                                ? (isAdminMsg ? (msg.color ? "" : "bg-gradient-to-br from-blue-600 via-indigo-700 to-violet-800 text-white shadow-xl border border-white/30 rounded-2xl") : "bg-gradient-to-br from-amber-500 to-orange-600 text-white shadow-lg border border-white/20 rounded-2xl")
                                : "bg-gradient-to-br from-indigo-600 to-purple-700 text-white shadow-lg border border-white/20 rounded-2xl"
                          ) : ""}`}
                        style={isEscrowOrNotify && isAdminMsg && msg.color ? {
                          background: `linear-gradient(135deg, ${msg.color} 0%, ${msg.color}cc 100%)`,
                          boxShadow: `0 10px 15px -3px ${msg.color}40`,
                          border: '1px solid rgba(255,255,255,0.3)'
                        } : {}}
                      >
                        {msg.isViewOnce ? (
                          <div
                            className={`flex items-center gap-3 py-1 cursor-pointer transition-all active:scale-95 ${msg.isOpened ? 'opacity-60' : 'hover:opacity-80'}`}
                            onClick={(e) => {
                              if (!isMine && !msg.isOpened && !isSelectionMode) {
                                e.stopPropagation();
                                if (msg.attachmentUrl) {
                                  setIsPreviewViewOnce(true);
                                  setPreviewImage(msg.attachmentUrl);
                                  handleOpenViewOnce(msg);
                                }
                              }
                            }}
                          >
                            <div className={`h-8 w-8 rounded-full flex items-center justify-center ${isMine ? 'bg-white/20' : 'bg-primary/10 text-primary'}`}>
                              {msg.isOpened ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                            </div>
                            <div className="flex flex-col">
                              <span className="text-sm font-bold">
                                {msg.isOpened ? "Viewed" : (isMine ? "Photo" : "View Photo")}
                              </span>
                              {!msg.isOpened && !isMine && <span className="text-[10px] opacity-70">Click to view once</span>}
                            </div>
                          </div>
                        ) : isEscrowOrNotify ? (
                          <div className="space-y-3">
                            <div className="flex items-center gap-3">
                              <div className={`h-10 w-10 rounded-full flex items-center justify-center backdrop-blur-md shadow-inner ${isAdminMsg ? 'bg-white/30 border border-white/40' : 'bg-white/20'}`}>
                                {msg.messageType === 'escrow_created' || (msg as any).message_type === 'escrow_created' ? <Plus className="h-5 w-5" /> : (
                                  (msg.messageType === 'escrow_released' || (msg as any).message_type === 'escrow_released') ? <IndianRupee className="h-5 w-5" /> : (
                                    (msg.messageType === 'notification' || (msg as any).message_type === 'notification' || isAdminMsg) ? <ShieldCheck className="h-5 w-5" /> : <ShieldCheck className="h-5 w-5" />
                                  )
                                )}
                              </div>
                              <div>
                                <p className="font-bold text-base leading-none flex items-center gap-1.5">
                                  {isAdminMsg ? (
                                    <>
                                      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                                      Admin Support
                                    </>
                                  ) : msg.messageType === 'escrow_created' || (msg as any).message_type === 'escrow_created' ? "Escrow Deal Created" : (
                                    (msg.messageType === 'escrow_released' || (msg as any).message_type === 'escrow_released') ? "Payment Released" : (
                                      (msg.messageType === 'notification' || (msg as any).message_type === 'notification') ? (msg.content.match(/\*\*(.*?)\*\*/) ? msg.content.match(/\*\*(.*?)\*\*/)?.[1] : "System Update") : "Payment Confirmed"
                                    )
                                  )}
                                </p>
                                <p className="text-[10px] text-white/70 mt-1 uppercase tracking-wider font-bold">
                                  {isAdminMsg ? "Official Help Center" : (msg.messageType === 'notification' || (msg as any).message_type === 'notification') ? "Official Notification" : "Official Escrow System"}
                                </p>
                              </div>
                            </div>
                            <div className={`bg-black/20 rounded-xl p-3 border border-white/10 backdrop-blur-sm ${isAdminMsg ? 'border-white/20' : ''}`}>
                              <p className="text-sm font-medium leading-relaxed">
                                {isAdminMsg ? (
                                  msg.content.split('\n').map((line, i) => (
                                    <React.Fragment key={i}>
                                      {line.split(/(\*\*.*?\*\*)/).map((part, j) => {
                                        if (part.startsWith('**') && part.endsWith('**')) {
                                          return <strong key={j} className="text-emerald-300">{part.slice(2, -2)}</strong>;
                                        }
                                        return part;
                                      })}
                                      {i < msg.content.split('\n').length - 1 && <br />}
                                    </React.Fragment>
                                  ))
                                ) : (msg.messageType === 'notification' || (msg as any).message_type === 'notification') ? msg.content.split('\n\n')[1] || msg.content.replace(/🔔 \*\*(.*?)\*\*\n\n/, '') : msg.content}
                              </p>
                            </div>
                            {(msg.messageType?.startsWith?.('escrow_') || (msg as any).message_type?.startsWith?.('escrow_')) && (
                              <button
                                onClick={(e) => {
                                  e.stopPropagation();
                                  navigate(`/escrow?chatId=${selectedChat.chat_id}`);
                                }}
                                className={`w-full py-2 bg-white rounded-lg text-sm font-bold shadow-sm hover:bg-white/90 transition-all flex items-center justify-center gap-2 active:scale-[0.98] ${(msg.messageType === 'escrow_released' || (msg as any).message_type === 'escrow_released') ? "text-emerald-700" : "text-indigo-700"
                                  }`}
                              >
                                View Details <ArrowLeft className="h-4 w-4 rotate-180" />
                              </button>
                            )}
                          </div>
                        ) : (
                          <p className="text-sm">{msg.content}</p>
                        )}
                        {msg.attachmentUrl && !msg.isDeleted && !msg.isViewOnce && (
                          <div className="mt-2 p-2 bg-black/10 rounded-lg flex items-center gap-2">
                            {msg.messageType === 'image' || msg.attachmentUrl.match(/\.(jpg|jpeg|png|gif|webp)$/i) ? (
                              <div
                                className="cursor-pointer hover:opacity-90 transition-opacity relative privacy-protected"
                                onContextMenu={(e) => e.preventDefault()}
                                onClick={() => {
                                  setIsPreviewViewOnce(false);
                                  setPreviewImage(msg.attachmentUrl || null);
                                }}
                              >
                                <img src={msg.attachmentUrl} alt="attachment" className="max-w-full rounded h-48 object-cover shadow-sm border border-white/10 select-none pointer-events-none" />
                                {(msg as any).isUploading && (
                                  <div className="absolute inset-0 bg-black/40 rounded flex items-center justify-center backdrop-blur-sm">
                                    <Loader2 className="h-8 w-8 text-white animate-spin" />
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex items-center gap-2 overflow-hidden">
                                <FileText className="h-5 w-5 shrink-0" />
                                <button
                                  onClick={(e) => {
                                    e.preventDefault();
                                    downloadFile(msg.attachmentUrl || "", msg.attachmentName || "download");
                                  }}
                                  className="text-xs underline truncate hover:text-primary transition-colors flex items-center gap-1"
                                >
                                  {msg.attachmentName || 'Download File'}
                                  <Download className="h-3 w-3" />
                                </button>
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
                  </React.Fragment>
                );
              })
            )}
            <div ref={messagesEndRef} className="h-4" />
          </div>
        </div>
      </div>

      {/* Input */}
      <div
        className="p-3 border-t border-border bg-background"
        style={{
          position: isMobile ? 'fixed' : 'static',
          left: 0,
          right: 0,
          bottom: isMobile ? 0 : 'auto',
          zIndex: isMobile ? 50 : 'auto',
          width: isMobile ? '100vw' : 'auto',
          maxWidth: isMobile ? '100vw' : 'none',
        }}
      >
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
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0"
              >
                <Paperclip className="h-5 w-5 text-muted-foreground" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-48 bg-card border-border">
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("image/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Camera className="h-4 w-4 mr-2" />
                <span>Camera</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("image/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Image className="h-4 w-4 mr-2" />
                <span>Photos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType("video/*");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <Film className="h-4 w-4 mr-2" />
                <span>Videos</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => {
                  setCurrentAcceptType(".pdf,.doc,.docx,.txt,.zip,.rar");
                  setTimeout(() => fileInputRef.current?.click(), 50);
                }}
              >
                <FileText className="h-4 w-4 mr-2" />
                <span>Documents</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileSelect}
            className="hidden"
            accept={currentAcceptType}
          />
          <Input
            ref={messageInputRef}
            className="bg-secondary border-border"
            placeholder="Type a message..."
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSend()}
            data-nopaste
            type="text"
            inputMode="text"
            autoComplete="off"
          />
          <Button size="icon" onClick={handleSend} className="shrink-0">
            <Send className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Modals outside flex flow */}
      <Dialog open={!!previewImage} onOpenChange={(open) => !open && setPreviewImage(null)}>
        <DialogContent className="max-w-4xl p-0 overflow-hidden bg-transparent border-none shadow-none flex items-center justify-center">
          <div
            className={`relative group overflow-auto max-h-[90vh] ${isPreviewViewOnce && !isHoldingView ? 'blur-2xl grayscale' : ''}`}
            onMouseDown={() => isPreviewViewOnce && setIsHoldingView(true)}
            onMouseUp={() => setIsHoldingView(false)}
            onMouseLeave={() => setIsHoldingView(false)}
            onTouchStart={() => isPreviewViewOnce && setIsHoldingView(true)}
            onTouchEnd={() => setIsHoldingView(false)}
          >
            <img
              src={previewImage || ""}
              alt="Preview"
              className="max-w-full max-h-[85vh] h-auto object-contain rounded-lg shadow-2xl select-none pointer-events-none privacy-protected"
              onContextMenu={(e) => e.preventDefault()}
            />
            {isPreviewViewOnce && !isHoldingView && (
              <div className="absolute inset-0 flex items-center justify-center bg-black/40 backdrop-blur-sm rounded-lg pointer-events-none">
                <div className="text-center p-6 text-white">
                  <div className="bg-white/20 p-4 rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4 border border-white/30 backdrop-blur-md">
                    <Eye className="h-8 w-8 text-white" />
                  </div>
                  <p className="text-lg font-bold">Press and hold to view</p>
                  <p className="text-xs opacity-70 mt-1">Screen capture is blocked</p>
                </div>
              </div>
            )}
            <div className="absolute top-4 right-4 flex gap-2">
              <Button
                variant="secondary"
                size="icon"
                className="rounded-full bg-black/50 hover:bg-black/70 border-none text-white h-10 w-10 shadow-lg backdrop-blur-sm"
                onClick={() => setPreviewImage(null)}
              >
                <ArrowLeft className="h-5 w-5 rotate-180" />
              </Button>
              {!isPreviewViewOnce && (
                <button
                  onClick={() => {
                    const filename = messages.find(m => m.attachmentUrl === previewImage)?.attachmentName || "download";
                    downloadFile(previewImage || "", filename);
                  }}
                  className="flex items-center justify-center h-10 w-10 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground shadow-lg transition-transform active:scale-95"
                >
                  <Download className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>
        </DialogContent>
      </Dialog>

      <FilePreviewDialog
        file={pendingFile}
        isOpen={!!pendingFile}
        onClose={() => setPendingFile(null)}
        onSend={handleConfirmUpload}
        isUploading={isLoading}
      />
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
              <Button variant="ghost" onClick={() => setIsReportDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                variant="destructive"
                onClick={handleReportUser}
                disabled={isLoading || !reportReason.trim()}
              >
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
  const { user, isLoading: authLoading, logout } = useAuth();
  const { toast } = useToast();

  const handleLogout = useCallback(() => {
    logout();
    navigate("/login", { replace: true });
  }, [logout, navigate]);

  // No longer redirecting admin to dashboard, allowing them to use ChatPage for support


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
  const [currentAcceptType, setCurrentAcceptType] = useState<string>("image/*,.pdf,.doc,.docx,.txt,.zip,.rar");
  const [selectedMessages, setSelectedMessages] = useState<number[]>([]);
  const [pendingFile, setPendingFile] = useState<File | null>(null);
  const [isBlurred, setIsBlurred] = useState(false);
  const [isPreviewViewOnce, setIsPreviewViewOnce] = useState(false);
  const [isHoldingView, setIsHoldingView] = useState(false);

  // Hide bottom navbar when in a chat on mobile
  useEffect(() => {
    if (selectedChat && isMobile) {
      document.body.classList.add('hide-navbar');
    } else {
      document.body.classList.remove('hide-navbar');
    }
    return () => document.body.classList.remove('hide-navbar');
  }, [selectedChat, isMobile]);


  // Blur when tab is hidden or window loses focus
  useEffect(() => {
    if (!selectedChat) return;
    const handleVisibility = () => {
      setIsBlurred(document.hidden);
    };
    const handleBlur = () => setIsBlurred(true);
    const handleFocus = () => setIsBlurred(false);

    document.addEventListener('visibilitychange', handleVisibility);
    window.addEventListener('blur', handleBlur);
    window.addEventListener('focus', handleFocus);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility);
      window.removeEventListener('blur', handleBlur);
      window.removeEventListener('focus', handleFocus);
    };
  }, [selectedChat]);

  // Disable right click/context menu on chat page
  useEffect(() => {
    const preventContextMenu = (e: MouseEvent) => {
      e.preventDefault();
    };
    document.addEventListener('contextmenu', preventContextMenu);
    return () => document.removeEventListener('contextmenu', preventContextMenu);
  }, []);


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
      verified: foundUser.verified || false,
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
    const targetChatId = params.get('chatId');

    if (chats.length > 0 && user) {
      if (targetChatId) {
        const chat = chats.find(c => c.chat_id === targetChatId);
        if (chat) {
          setSelectedChat(chat);
          window.history.replaceState({}, '', '/chat');
          return;
        }
      }

      if (targetUserId) {
        const targetIdNum = parseInt(targetUserId);

        // Validation for non-numeric ID or missing ID
        if (isNaN(targetIdNum) || targetIdNum === user.id) {
          window.history.replaceState({}, '', '/chat');
          return;
        }

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
    }
  }, [user, chats, startChat]);

  // Load chats on mount and when user changes
  useEffect(() => {
    if (!user && !authLoading) {
      navigate("/login", { replace: true });
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

  // Handle View Once messages being opened
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessageOpened((msg: MessageType) => {
      if (selectedChat && msg.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) => (m.id === msg.id ? msg : m))
        );
      }
      loadChats();
    });
    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Load messages and join room when selected chat changes
  useEffect(() => {
    // Clear blur state when changing chats
    setIsBlurred(false);

    if (selectedChat && user) {
      loadMessages(selectedChat.chat_id);
      socketService.joinChat(user.id, selectedChat.chat_id);
      // Mark as read when opening chat
      markMessagesAsRead(selectedChat.chat_id).then(() => loadChats());
    }
  }, [selectedChat?.chat_id, user, loadMessages, loadChats]);

  // Handle message deletion from other users
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onMessageDeleted((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        setMessages((prev) =>
          prev.map((m) =>
            m.id === data.messageId
              ? { ...m, isDeleted: true, content: "This message was deleted", attachmentUrl: undefined, attachmentName: undefined }
              : m
          )
        );
      }
      loadChats(); // Update last message in chat list
    });
    return cleanup;
  }, [user, selectedChat, loadChats]);

  // Handle screenshot attempt notifications from other users
  useEffect(() => {
    if (!user) return;
    const cleanup = socketService.onScreenshotAttempt((data) => {
      if (selectedChat && data.chatId === selectedChat.chat_id) {
        // Add screenshot attempt notification to messages
        setMessages((prev) => {
          // Prevent duplicates
          const isDuplicate = prev.some(m =>
            m.messageType === 'notification' &&
            m.content.includes('attempted to take a screenshot') &&
            Math.abs(new Date(m.createdAt).getTime() - new Date(data.message.createdAt).getTime()) < 1000
          );

          if (isDuplicate) return prev;
          return [...prev, data.message];
        });
      }
    });
    return cleanup;
  }, [user, selectedChat]);

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
        is_view_once: false // Text messages are no longer view-once via main input
      });
      await loadMessages(selectedChat.chat_id);
      await loadChats();

      // Refocus input after sending (keep keyboard open on mobile)
      if (messageInputRef.current) {
        messageInputRef.current.focus();
        // Scroll input into view for mobile
        if (window.innerWidth <= 600) {
          messageInputRef.current.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
      setNewMessage(messageToSend);
    }
  }, [newMessage, selectedChat, user, loadMessages, loadChats]);

  const handleMessageDeleted = useCallback(async (messageId: number) => {
    try {
      await deleteMessage(messageId);
      toast({ title: "Message Deleted", description: "Your message has been deleted." });
      if (selectedChat) loadMessages(selectedChat.chat_id);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete message", variant: "destructive" });
    }
  }, [selectedChat, loadMessages, toast]);

  const handleDeleteMessagesBatch = useCallback(async (ids: number[]) => {
    if (ids.length === 0) return;
    try {
      await deleteMessagesBatch(ids);
      toast({ title: "Messages Deleted", description: `${ids.length} messages have been deleted.` });
      setSelectedMessages([]);
      if (selectedChat) loadMessages(selectedChat.chat_id);
    } catch (err) {
      toast({ title: "Error", description: err instanceof Error ? err.message : "Failed to delete messages", variant: "destructive" });
    }
  }, [selectedChat, loadMessages, toast]);


  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !selectedChat || !user) return;

    // Check file size (500MB limit)
    if (file.size > 500 * 1024 * 1024) {
      setError("File is too large. Max size is 500MB.");
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setPendingFile(file);
    // Reset file input so same file can be selected again
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [selectedChat, user]);

  const handleConfirmUpload = useCallback(async (caption: string, viewOnce: boolean) => {
    if (!pendingFile || !selectedChat || !user) return;

    // Create optimistic message immediately
    const tempId = Date.now();
    const tempMessage: MessageType = {
      id: tempId,
      chatId: selectedChat.chat_id,
      senderId: user.id,
      receiverId: selectedChat.user_id,
      content: caption || `Sent a file: ${pendingFile.name}`,
      messageType: pendingFile.type.startsWith('image/') ? 'image' : 'file',
      attachmentUrl: URL.createObjectURL(pendingFile), // Temporary local URL
      attachmentName: pendingFile.name,
      createdAt: new Date().toISOString(),
      read: false,
      isDeleted: false,
      isViewOnce: viewOnce
    } as MessageType & { isUploading?: boolean };

    // Add optimistic message to UI
    setMessages(prev => [...prev, tempMessage]);
    setPendingFile(null);

    setIsLoading(true);
    try {
      const result = await uploadFile({
        receiver_id: selectedChat.user_id,
        chat_id: selectedChat.chat_id,
        file: pendingFile,
        content: caption || `Sent a file: ${pendingFile.name}`,
        is_view_once: viewOnce
      });

      // Replace optimistic message with real one
      await loadMessages(selectedChat.chat_id);
      await loadChats();
    } catch (err) {
      // Remove optimistic message on error
      setMessages(prev => prev.filter(m => m.id !== tempId));
      setError(err instanceof Error ? err.message : "Failed to upload file");
    } finally {
      setIsLoading(false);
    }
  }, [pendingFile, selectedChat, user, loadMessages, loadChats]);

  const handleSupport = useCallback(async () => {
    try {
      setIsLoading(true);
      const { admin } = await getSupportChat();

      // Start chat with admin
      const supportChat: ChatType = {
        chat_id: `support_${user?.id}`,
        last_message: "Official Support & Notifications",
        last_message_time: new Date().toISOString(),
        user_id: admin.id,
        display_name: "Help Center",
        avatar_url: admin.avatarUrl,
        username: admin.username,
        unread_count: 0,
        verified: true,
        isOfficial: true,
      };

      setSelectedChat(supportChat);
      setSearchQuery("");
      setMessages([]);
    } catch (err) {
      toast({
        title: "Support Unavailable",
        description: err instanceof Error ? err.message : "Failed to connect to support",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [user?.id, toast]);

  const filteredChats = chats.filter((c) =>
    c.display_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  if (authLoading) return <LoadingScreen />;

  // Mobile: show one panel at a time
  if (isMobile) {
    return (
      <div className={`${selectedChat ? 'h-[100dvh]' : 'h-[calc(100dvh-64px)]'} overflow-hidden`}>
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
            onMessageDeleted={handleMessageDeleted}
            selectedMessages={selectedMessages}
            setSelectedMessages={setSelectedMessages}
            onDeleteMessagesBatch={handleDeleteMessagesBatch}
            pendingFile={pendingFile}
            setPendingFile={setPendingFile}
            handleConfirmUpload={handleConfirmUpload}
            isLoading={isLoading}
            isBlurred={isBlurred}
            setIsBlurred={setIsBlurred}
            isPreviewViewOnce={isPreviewViewOnce}
            setIsPreviewViewOnce={setIsPreviewViewOnce}
            currentAcceptType={currentAcceptType}
            setCurrentAcceptType={setCurrentAcceptType}
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
            user={user}
            onLogout={handleLogout}
            onSupport={handleSupport}
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
          user={user}
          onLogout={handleLogout}
          onSupport={handleSupport}
        />
      </div>
      <div className="flex-1 h-full min-h-0 overflow-hidden">
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
          onMessageDeleted={handleMessageDeleted}
          selectedMessages={selectedMessages}
          setSelectedMessages={setSelectedMessages}
          onDeleteMessagesBatch={handleDeleteMessagesBatch}
          pendingFile={pendingFile}
          setPendingFile={setPendingFile}
          handleConfirmUpload={handleConfirmUpload}
          currentAcceptType={currentAcceptType}
          setCurrentAcceptType={setCurrentAcceptType}
          isLoading={isLoading}
          isBlurred={isBlurred}
          setIsBlurred={setIsBlurred}
          isPreviewViewOnce={isPreviewViewOnce}
          setIsPreviewViewOnce={setIsPreviewViewOnce}
        />
      </div>
    </div>
  );
};

export default ChatPage;
