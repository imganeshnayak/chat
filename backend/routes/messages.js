import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 500 * 1024 * 1024 }, // 500MB limit
    fileFilter: (req, file, cb) => {
        const forbiddenExtensions = ['.exe', '.bat', '.sh', '.msi'];
        const isForbidden = forbiddenExtensions.some(ext => file.originalname.toLowerCase().endsWith(ext));

        if (isForbidden) {
            cb(new Error('This file type is not allowed for security reasons.'), false);
        } else {
            cb(null, true);
        }
    }
});

// GET /api/messages/chats/list - Get chat list for current user (must be before /:chatId)
router.get('/chats/list', auth, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { OR: [{ senderId: req.user.id }, { receiverId: req.user.id }] },
            orderBy: { createdAt: 'desc' },
            include: { sender: { select: { id: true, displayName: true, avatarUrl: true, username: true, verified: true } }, receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true, verified: true } } },
        });

        // Group by chatId and get latest message per chat
        const chatMap = new Map();
        for (const msg of messages) {
            if (!chatMap.has(msg.chatId)) {
                const otherUser = msg.senderId === req.user.id ? msg.receiver : msg.sender;
                const unreadCount = await prisma.message.count({
                    where: { chatId: msg.chatId, read: false, receiverId: req.user.id },
                });
                chatMap.set(msg.chatId, {
                    chat_id: msg.chatId,
                    last_message: msg.isViewOnce && !msg.isOpened ? (msg.messageType === 'image' || msg.messageType === 'file' ? "Photo" : "View Once Message") : msg.content,
                    last_message_time: msg.createdAt,
                    user_id: otherUser.id,
                    display_name: otherUser.displayName,
                    avatar_url: otherUser.avatarUrl,
                    username: otherUser.username,
                    unread_count: unreadCount,
                    verified: otherUser.verified || false,
                });
            }
        }

        // Ensure "Admin" (Support Admin) is always in the list for regular users
        const supportChatId = `support_${req.user.id}`;
        if (req.user.role !== 'admin' && !chatMap.has(supportChatId)) {
            const admin = await prisma.user.findFirst({
                where: { role: 'admin', status: 'active' },
                select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true }
            });

            if (admin) {
                chatMap.set(supportChatId, {
                    chat_id: supportChatId,
                    last_message: "Official Support & Notifications",
                    last_message_time: new Date().toISOString(),
                    user_id: admin.id,
                    display_name: "Admin",
                    avatar_url: null, // Use default system avatar, not specific admin's pic
                    username: "admin", // Generic username
                    unread_count: 0,
                    verified: true,
                    isOfficial: true // Special flag for frontend
                });
            }
        } else {
            // Update existing support chat entry with branding
            const supportEntry = chatMap.get(supportChatId);
            supportEntry.display_name = "Admin";
            supportEntry.avatar_url = null; // Ensure generic avatar
            supportEntry.username = "admin";
            supportEntry.isOfficial = true;
        }

        res.json(Array.from(chatMap.values()));
    } catch (err) {
        console.error('Get chats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/messages/support - Get the Help Center details
router.get('/support', auth, async (req, res) => {
    try {
        // Find first active admin
        const admin = await prisma.user.findFirst({
            where: { role: 'admin', status: 'active' },
            select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true }
        });

        if (!admin) {
            return res.status(404).json({ error: 'Support team not available.' });
        }

        const chatId = `support_${req.user.id}`;

        res.json({
            admin: { ...admin, displayName: "Admin", avatarUrl: null, username: "admin" }, // Generic details
            chatId
        });
    } catch (err) {
        console.error('Get support error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/messages/:chatId - Get messages for a chat
router.get('/:chatId', auth, async (req, res) => {
    try {
        const messages = await prisma.message.findMany({
            where: { chatId: req.params.chatId },
            orderBy: { createdAt: 'asc' },
            include: {
                sender: { select: { displayName: true, avatarUrl: true, username: true } },
            },
        });

        const result = messages.map(m => ({
            ...m,
            sender_name: m.sender.displayName,
            sender_avatar: m.sender.avatarUrl,
            sender_username: m.sender.username,
            sender: undefined,
        }));

        res.json(result);
    } catch (err) {
        console.error('Get messages error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages - Send a message
router.post('/', auth, async (req, res) => {
    try {
        const { receiver_id, chat_id, content, message_type } = req.body;

        // Check if sender is blocked by receiver
        const isBlocked = await prisma.blockedUser.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: parseInt(receiver_id),
                    blockedId: req.user.id
                }
            }
        });

        if (isBlocked) {
            return res.status(403).json({ error: "You are blocked by this user." });
        }

        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverId: parseInt(receiver_id),
                chatId: chat_id,
                content,
                messageType: message_type || 'text',
                isViewOnce: req.body.is_view_once === true || req.body.is_view_once === 'true'
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } },
        });

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Sent message' } });

        const result = {
            ...message,
            sender_name: message.sender.displayName,
            sender_avatar: message.sender.avatarUrl,
            sender_username: message.sender.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(chat_id).emit('newMessage', result);
            // Also notify receiver's personal room to refresh their chat list
            io.to(`user_${receiver_id}`).emit('newMessage', result);

            // If it's a support chat, broadcast to ALL admins
            if (chat_id.startsWith('support_')) {
                io.to('admin_broadcast').emit('newMessage', result);
            }
        }

        res.status(201).json(result);
    } catch (err) {
        console.error('Send message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages/upload - Send message with file attachment via Cloudinary
router.post('/upload', auth, upload.single('file'), async (req, res) => {
    try {
        const { receiver_id, chat_id, content } = req.body;

        // Check if sender is blocked by receiver
        const isBlocked = await prisma.blockedUser.findUnique({
            where: {
                blockerId_blockedId: {
                    blockerId: parseInt(receiver_id),
                    blockedId: req.user.id
                }
            }
        });

        if (isBlocked) {
            return res.status(403).json({ error: "You are blocked by this user." });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const uploadResult = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'vesper/attachments', resource_type: 'auto', access_mode: 'public' },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        const message = await prisma.message.create({
            data: {
                senderId: req.user.id,
                receiverId: parseInt(receiver_id),
                chatId: chat_id,
                content: content || 'File shared',
                messageType: 'file',
                attachmentUrl: uploadResult.secure_url,
                attachmentName: req.file.originalname,
                isViewOnce: req.body.is_view_once === true || req.body.is_view_once === 'true'
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } },
        });

        const result = {
            ...message,
            sender_name: message.sender.displayName,
            sender_avatar: message.sender.avatarUrl,
            sender_username: message.sender.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(chat_id).emit('newMessage', result);
            // Also notify receiver's personal room for chat list updates
            io.to(`user_${receiver_id}`).emit('newMessage', result);
        }

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'File uploaded' } });

        res.status(201).json(result);
    } catch (err) {
        console.error('File upload error:', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

// PUT /api/messages/read/:chatId - Mark all messages in a chat as read
router.put('/read/:chatId', auth, async (req, res) => {
    try {
        await prisma.message.updateMany({
            where: {
                chatId: req.params.chatId,
                receiverId: req.user.id,
                read: false,
            },
            data: { read: true },
        });

        const io = req.app.get('io');
        if (io) {
            io.to(req.params.chatId).emit('messagesRead', {
                chatId: req.params.chatId,
                readerId: req.user.id,
            });
        }

        res.json({ success: true });
    } catch (err) {
        console.error('Mark as read error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/messages/chat/:chatId - Clear chat history
router.delete('/chat/:chatId', auth, async (req, res) => {
    try {
        const { chatId } = req.params;

        // Verify user is part of the chat
        const isParticipant = await prisma.message.findFirst({
            where: {
                chatId,
                OR: [{ senderId: req.user.id }, { receiverId: req.user.id }]
            }
        });

        if (!isParticipant) {
            return res.status(403).json({ error: "Not authorized to clear this chat." });
        }

        // We could technically soft delete for only one user, but standard "Clear History" 
        // in many simple apps deletes for all. For now, we'll delete all messages in this chatId.
        await prisma.message.deleteMany({
            where: { chatId }
        });

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Cleared chat history', details: `Chat ID: ${chatId}` } });

        res.json({ message: "Chat history cleared successfully." });
    } catch (err) {
        console.error('Clear history error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/messages/batch-delete - Delete multiple messages
router.post('/batch-delete', auth, async (req, res) => {
    try {
        const { ids } = req.body;
        if (!Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ error: "Invalid message IDs." });
        }

        // Find all messages to ensure they belong to the user
        const messages = await prisma.message.findMany({
            where: {
                id: { in: ids },
                senderId: req.user.id
            }
        });

        if (messages.length === 0) {
            return res.status(404).json({ error: "No valid messages found to delete." });
        }

        const validIds = messages.map(m => m.id);
        const chatId = messages[0].chatId;

        // Perform soft delete
        await prisma.message.updateMany({
            where: { id: { in: validIds } },
            data: {
                isDeleted: true,
                content: "This message was deleted",
                attachmentUrl: null,
                attachmentName: null
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(chatId).emit('messagesDeleted', {
                messageIds: validIds,
                chatId: chatId
            });
        }

        res.json({ success: true, count: validIds.length });
    } catch (err) {
        console.error('Batch delete error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/messages/:id - Delete (soft delete) an individual message
router.delete('/:id', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const messageId = parseInt(id);

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found." });
        }

        if (message.senderId !== req.user.id) {
            return res.status(403).json({ error: "You can only delete your own messages." });
        }

        // Soft delete: keep the record but mark it as deleted
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                isDeleted: true,
                content: "This message was deleted",
                attachmentUrl: null,
                attachmentName: null
            }
        });

        const io = req.app.get('io');
        if (io) {
            io.to(message.chatId).emit('messageDeleted', {
                messageId: messageId,
                chatId: message.chatId
            });
        }

        res.json({ success: true, message: "Message deleted." });
    } catch (err) {
        console.error('Delete message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/messages/:id/open - Mark a view-once message as opened
router.put('/:id/open', auth, async (req, res) => {
    try {
        const { id } = req.params;
        const messageId = parseInt(id);

        const message = await prisma.message.findUnique({
            where: { id: messageId }
        });

        if (!message) {
            return res.status(404).json({ error: "Message not found." });
        }

        // Only the receiver can open the message
        if (message.receiverId !== req.user.id) {
            return res.status(403).json({ error: "Only the recipient can open this message." });
        }

        if (!message.isViewOnce) {
            return res.status(400).json({ error: "This is not a view-once message." });
        }

        if (message.isOpened) {
            return res.status(400).json({ error: "Message already viewed." });
        }

        // Mark as opened and mask content
        const updatedMessage = await prisma.message.update({
            where: { id: messageId },
            data: {
                isOpened: true,
                content: "View Once message opened",
                attachmentUrl: null,
                attachmentName: null
            },
            include: { sender: { select: { displayName: true, avatarUrl: true, username: true } } }
        });

        const result = {
            ...updatedMessage,
            sender_name: updatedMessage.sender.displayName,
            sender_avatar: updatedMessage.sender.avatarUrl,
            sender_username: updatedMessage.sender.username,
        };

        const io = req.app.get('io');
        if (io) {
            io.to(message.chatId).emit('messageOpened', result);
        }

        res.json(result);
    } catch (err) {
        console.error('Open view-once message error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
