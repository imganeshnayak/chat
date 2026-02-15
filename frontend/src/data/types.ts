export type UserRole = "client" | "vendor" | "admin";

export interface User {
  id: string;
  name: string;
  avatar: string;
  role: UserRole;
  bio: string;
  phone: string;
  email: string;
  online: boolean;
  lastSeen: string;
}

export interface Message {
  id: string;
  chatId: string;
  senderId: string;
  text?: string;
  mediaUrl?: string;
  mediaType?: "image" | "document" | "voice";
  timestamp: string;
  read: boolean;
}

export interface Chat {
  id: string;
  participants: string[];
  lastMessage?: Message;
  unreadCount: number;
}

export interface EscrowDeal {
  id: string;
  chatId: string;
  clientId: string;
  vendorId: string;
  title: string;
  description: string;
  totalAmount: number;
  releasedPercent: number;
  status: "active" | "completed" | "disputed";
  transactions: EscrowTransaction[];
  createdAt: string;
}

export interface EscrowTransaction {
  id: string;
  dealId: string;
  percent: number;
  amount: number;
  note: string;
  timestamp: string;
}
