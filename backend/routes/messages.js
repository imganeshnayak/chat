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
            include: { sender: { select: { id: true, displayName: true, avatarUrl: true, username: true } }, receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true } } },
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
                    last_message: msg.content,
                    last_message_time: msg.createdAt,
                    user_id: otherUser.id,
                    display_name: otherUser.displayName,
                    avatar_url: otherUser.avatarUrl,
                    username: otherUser.username,
                    unread_count: unreadCount,
                });
            }
        }

        res.json(Array.from(chatMap.values()));
    } catch (err) {
        console.error('Get chats error:', err);
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
            data: { senderId: req.user.id, receiverId: parseInt(receiver_id), chatId: chat_id, content, messageType: message_type || 'text' },
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

export default router;
