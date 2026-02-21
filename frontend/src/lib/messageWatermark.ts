/**
 * Generate a unique watermark ID for each message
 * This helps identify if a screenshot originates from a specific chat session
 */
export const generateMessageWatermarkId = (
  messageId: number,
  chatId: string,
  userId: number,
  timestamp: string
): string => {
  // Create a hash-like ID that includes session info
  const data = `${messageId}-${chatId}-${userId}-${timestamp}`;
  let hash = 0;
  
  for (let i = 0; i < data.length; i++) {
    const char = data.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  return `MSG-${Math.abs(hash).toString(16).toUpperCase().padStart(8, '0')}`;
};

/**
 * Format watermark text for display
 */
export const formatMessageWatermark = (
  messageId: number,
  chatId: string,
  userId: number,
  timestamp: string,
  isSensitive: boolean = false
): string => {
  const watermarkId = generateMessageWatermarkId(messageId, chatId, userId, timestamp);
  const date = new Date(timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  });
  
  if (isSensitive) {
    return `[🔒 ${watermarkId} - ${date}]`;
  }
  
  return `${watermarkId}`;
};

/**
 * Add watermark metadata to screenshot if captured
 * This creates a fingerprint of when/where the screenshot was taken
 */
export const createWatermarkedMessage = (
  content: string,
  messageId: number,
  chatId: string,
  userId: number,
  timestamp: string,
  isSensitive: boolean = false
): { content: string; watermark: string } => {
  const watermark = formatMessageWatermark(messageId, chatId, userId, timestamp, isSensitive);
  
  return {
    content,
    watermark
  };
};
