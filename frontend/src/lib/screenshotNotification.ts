import { Message as MessageType } from "@/lib/api";

/**
 * Create a system message for screenshot attempt notification
 */
export const createScreenshotNotification = (
  attemptedBy: string,
  username: string,
  displayName: string,
  isOwnAttempt: boolean = false
): MessageType => {
  const now = new Date().toISOString();
  
  return {
    id: Date.now(),
    chatId: "", // Will be set by caller
    senderId: 0, // System message
    receiverId: 0,
    content: isOwnAttempt 
      ? `� **Screenshot Blocked** - You attempted to take a screenshot. This action has been recorded.`
      : `🔒 **Screenshot Attempt Detected** - **${displayName}** attempted to take a screenshot. This action has been recorded.`,
    messageType: "notification",
    attachmentUrl: undefined,
    attachmentName: undefined,
    createdAt: now,
    read: false,
    isDeleted: false,
    isViewOnce: false,
    color: isOwnAttempt ? "#dc2626" : "#ea580c" // Darker red for own, darker orange for others
  } as any;
};

/**
 * Format screenshot notification for display
 */
export const formatScreenshotNotification = (
  displayName: string,
  isOwnAttempt: boolean = false
): string => {
  if (isOwnAttempt) {
    return `🔒 You attempted to take a screenshot`;
  }
  return `🔒 **${displayName}** attempted to take a screenshot`;
};
