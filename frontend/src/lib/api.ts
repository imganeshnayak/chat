// src/lib/api.ts

const API_URL = import.meta.env.VITE_API_URL || "http://localhost:5000";

export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
  const token = localStorage.getItem("authToken");

  const res = await fetch(`${API_URL}${path}`, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(token && { 'Authorization': `Bearer ${token}` }),
      ...(options?.headers || {}),
    },
    ...options,
  });

  if (!res.ok) {
    const errorText = await res.text();
    let errorMessage = errorText;

    try {
      const errorJson = JSON.parse(errorText);
      errorMessage = errorJson.error || errorText;

      // Handle account suspension/banned globally
      if (res.status === 403 && (errorMessage.toLowerCase().includes("suspended") || errorMessage.toLowerCase().includes("banned"))) {
        localStorage.removeItem("authToken");
        localStorage.removeItem("authUser");
        window.location.href = "/login?error=" + encodeURIComponent(errorMessage);
      }
    } catch (e) {
      // Not JSON, use raw text
    }

    throw new Error(errorMessage);
  }

  return res.json();
}

// ============ Auth API ============

export interface AuthUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  bio?: string;
  avatarUrl?: string;
  role: string;
  status: string;
  verified?: boolean;
  socialLinks?: { platform: string; url: string }[];
  createdAt: string;
  averageRating?: number;
  ratingCount?: number;
}

export interface AuthResponse {
  user: AuthUser;
  token: string;
}

export function registerUser(data: {
  username: string;
  email: string;
  password: string;
  display_name?: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginUser(data: {
  email: string;
  password: string;
}): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function loginWithTelegram(data: any): Promise<AuthResponse> {
  return apiFetch<AuthResponse>("/api/auth/telegram", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getCurrentUser(): Promise<AuthUser> {
  return apiFetch<AuthUser>("/api/auth/me");
}

// ============ Users API ============

export function getUser(id: number): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/${id}`);
}

export function searchUsers(query: string): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>(`/api/users/search?q=${encodeURIComponent(query)}`);
}

export function rateUser(data: {
  reviewedId: number;
  rating: number;
  comment?: string;
}): Promise<any> {
  return apiFetch("/api/users/rate", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getAllUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/users");
}

export function updateUserProfile(
  userId: number,
  data: {
    displayName?: string;
    bio?: string;
    telegramId?: string;
    email?: string;
    avatarUrl?: string;
    socialLinks?: { platform: string; url: string }[];
  }
): Promise<AuthUser> {
  return apiFetch<AuthUser>(`/api/users/profile/${userId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export async function uploadAvatar(file: File): Promise<{ avatarUrl: string }> {
  const formData = new FormData();
  formData.append("avatar", file);

  const token = localStorage.getItem("authToken");
  const res = await fetch(`${API_URL}/api/users/avatar`, {
    method: "POST",
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error);
  }

  return res.json();
}

// ============ Messages API ============

export interface Message {
  id: number;
  senderId: number;
  receiverId: number;
  chatId: string;
  content: string;
  messageType: string;
  read: boolean;
  isDeleted?: boolean;
  createdAt: string;
  attachmentUrl?: string;
  attachmentName?: string;
  sender_name?: string;
  sender_avatar?: string;
  sender_username?: string;
}

export interface Chat {
  chat_id: string;
  last_message: string;
  last_message_time: string;
  user_id: number;
  display_name: string;
  avatar_url?: string;
  username: string;
  unread_count: number;
  verified: boolean;
}

// ============ Moderation API ============

export function blockUser(blockedId: number): Promise<any> {
  return apiFetch("/api/moderation/block", {
    method: "POST",
    body: JSON.stringify({ blockedId }),
  });
}

export function unblockUser(userId: number): Promise<any> {
  return apiFetch(`/api/moderation/block/${userId}`, {
    method: "DELETE",
  });
}

export function getBlockedUsers(): Promise<AuthUser[]> {
  return apiFetch<AuthUser[]>("/api/moderation/blocked");
}

export function reportUser(reportedId: number, reason: string): Promise<any> {
  return apiFetch("/api/moderation/report", {
    method: "POST",
    body: JSON.stringify({ reportedId, reason }),
  });
}

export function clearChatHistory(chatId: string): Promise<any> {
  return apiFetch(`/api/messages/chat/${chatId}`, {
    method: "DELETE",
  });
}

export function getChatList(): Promise<Chat[]> {
  return apiFetch<Chat[]>("/api/messages/chats/list");
}

export function getMessages(chatId: string): Promise<Message[]> {
  return apiFetch<Message[]>(`/api/messages/${chatId}`);
}

export function sendMessage(data: {
  receiver_id: number;
  chat_id: string;
  content: string;
  message_type?: string;
}): Promise<Message> {
  return apiFetch<Message>("/api/messages", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function deleteMessage(messageId: number): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/messages/${messageId}`, {
    method: "DELETE",
  });
}

export function deleteMessagesBatch(messageIds: number[]): Promise<any> {
  return apiFetch("/api/messages/batch-delete", {
    method: "POST",
    body: JSON.stringify({ ids: messageIds }),
  });
}

export function markMessagesAsRead(chatId: string): Promise<{ success: boolean }> {
  return apiFetch<{ success: boolean }>(`/api/messages/read/${chatId}`, {
    method: "PUT",
  });
}

export async function uploadFile(data: {
  receiver_id: number;
  chat_id: string;
  file: File;
  content?: string;
}): Promise<Message> {
  const formData = new FormData();
  formData.append("receiver_id", data.receiver_id.toString());
  formData.append("chat_id", data.chat_id);
  formData.append("file", data.file);
  if (data.content) formData.append("content", data.content);

  const token = localStorage.getItem("authToken");

  const res = await fetch(`${API_URL}/api/messages/upload`, {
    method: "POST",
    headers: {
      ...(token && { 'Authorization': `Bearer ${token}` }),
    },
    body: formData,
  });

  if (!res.ok) {
    const error = await res.text();
    throw new Error(error);
  }

  return res.json();
}

// ============ Admin API ============

export interface ActivityLog {
  id: number;
  userId: number;
  action: string;
  details?: string;
  status: string;
  createdAt: string;
  user: {
    displayName: string;
    username: string;
    avatarUrl?: string;
  };
}

export interface AdminStats {
  totalUsers: number;
  activeUsers: number;
  totalMessages: number;
  totalChats: number;
  totalEscrowDeals: number;
  activeEscrowDeals: number;
  totalEscrowValue: number;
  recentActivity: number;
}

export interface AdminReport {
  id: number;
  reporterId: number;
  reportedId: number;
  reason: string;
  status: string;
  createdAt: string;
  reporter: { username: string; displayName: string };
  reported: { username: string; displayName: string };
}

export function getAdminReports(): Promise<{ reports: AdminReport[] }> {
  return apiFetch<{ reports: AdminReport[] }>("/api/admin/reports");
}

export function updateReportStatus(reportId: number, status: string): Promise<any> {
  return apiFetch(`/api/admin/reports/${reportId}`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  displayName: string;
  avatarUrl?: string;
  role: string;
  status: string;
  createdAt: string;
  _count: {
    sentMessages: number;
    clientDeals: number;
    vendorDeals: number;
  };
}

export function getAdminStats(): Promise<AdminStats> {
  return apiFetch<AdminStats>("/api/admin/stats");
}

export function getAdminUsers(params?: {
  page?: number;
  limit?: number;
  search?: string;
  status?: string;
}): Promise<{
  users: AdminUser[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.search) query.append("search", params.search);
  if (params?.status) query.append("status", params.status);

  return apiFetch(`/api/admin/users?${query.toString()}`);
}

export function getAdminChats(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  chats: any[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  return apiFetch(`/api/admin/chats?${query.toString()}`);
}

export function getAdminChatMessages(chatId: string): Promise<Message[]> {
  return apiFetch(`/api/admin/chats/${chatId}/messages`);
}

export function getAdminEscrowDeals(params?: {
  page?: number;
  limit?: number;
  status?: string;
}): Promise<{
  deals: EscrowDeal[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());
  if (params?.status) query.append("status", params.status);

  return apiFetch(`/api/admin/escrow?${query.toString()}`);
}

export function getActivityLogs(params?: {
  page?: number;
  limit?: number;
}): Promise<{
  activities: ActivityLog[];
  total: number;
  page: number;
  totalPages: number;
}> {
  const query = new URLSearchParams();
  if (params?.page) query.append("page", params.page.toString());
  if (params?.limit) query.append("limit", params.limit.toString());

  return apiFetch(`/api/admin/activity-logs?${query.toString()}`);
}

export function updateUserStatus(
  userId: number,
  status: string
): Promise<AdminUser> {
  return apiFetch(`/api/admin/users/${userId}/status`, {
    method: "PUT",
    body: JSON.stringify({ status }),
  });
}

export function updateUserRole(
  userId: number,
  role: string
): Promise<AdminUser> {
  return apiFetch(`/api/admin/users/${userId}/role`, {
    method: "PUT",
    body: JSON.stringify({ role }),
  });
}

export function deleteUser(userId: number): Promise<{ success: boolean }> {
  return apiFetch(`/api/admin/users/${userId}`, {
    method: "DELETE",
  });
}

// ============ Escrow API ============

export interface EscrowTransaction {
  id: number;
  dealId: number;
  percent: number;
  amount: number;
  note?: string;
  createdAt: string;
}

export interface EscrowDeal {
  id: number;
  chatId: string;
  clientId: number;
  vendorId: number;
  title: string;
  description?: string;
  totalAmount: number;
  releasedPercent: number;
  status: string;
  createdAt: string;
  updatedAt: string;
  client: {
    id: number;
    displayName: string;
    avatarUrl?: string;
    username: string;
  };
  vendor: {
    id: number;
    displayName: string;
    avatarUrl?: string;
    username: string;
  };
  transactions: EscrowTransaction[];
}

export function getEscrowDeals(): Promise<EscrowDeal[]> {
  return apiFetch<EscrowDeal[]>("/api/escrow");
}

export function getEscrowDeal(id: number): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${id}`);
}

export function createEscrowDeal(data: {
  chatId: string;
  vendorId: number;
  title: string;
  description?: string;
  totalAmount: number;
}): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>("/api/escrow", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function releaseEscrowPayment(
  dealId: number,
  data: {
    percent: number;
    note?: string;
  }
): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${dealId}/release`, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateEscrowDeal(
  dealId: number,
  data: {
    title?: string;
    description?: string;
    status?: string;
  }
): Promise<EscrowDeal> {
  return apiFetch<EscrowDeal>(`/api/escrow/${dealId}`, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

// ============ Verification API ============

export interface VerificationRequest {
  id: number;
  userId: number;
  status: string; // pending, approved, rejected
  paymentAmount: number;
  paymentProof?: string;
  adminNote?: string;
  createdAt: string;
  reviewedAt?: string;
  user?: AuthUser;
}

export function applyForVerification(data: { paymentProof?: string }): Promise<VerificationRequest> {
  return apiFetch<VerificationRequest>("/api/verification/apply", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function getVerificationStatus(): Promise<VerificationRequest | null> {
  return apiFetch<VerificationRequest | null>("/api/verification/status");
}

export function getVerificationFee(): Promise<{ fee: number; currency: string }> {
  return apiFetch<{ fee: number; currency: string }>("/api/verification/fee");
}

// Admin functions
export function getVerificationRequests(status?: string): Promise<VerificationRequest[]> {
  const query = status ? `?status=${status}` : '';
  return apiFetch<VerificationRequest[]>(`/api/verification/requests${query}`);
}

export function approveVerificationRequest(requestId: number): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/verification/requests/${requestId}/approve`, {
    method: "PUT",
  });
}

export function rejectVerificationRequest(
  requestId: number,
  adminNote?: string
): Promise<{ message: string }> {
  return apiFetch<{ message: string }>(`/api/verification/requests/${requestId}/reject`, {
    method: "PUT",
    body: JSON.stringify({ adminNote }),
  });
}
