import express from 'express';
import { PrismaClient } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { auth, adminOnly } from '../middleware/auth.js';

const router = express.Router();
const prisma = new PrismaClient();


// GET /api/notifications — fetch all notifications with read status for current user
router.get('/', auth, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({
            orderBy: { createdAt: 'desc' },
            take: 100,
            include: {
                admin: { select: { displayName: true, username: true, avatarUrl: true } },
                reads: {
                    where: { userId: req.user.id }
                }
            }
        });

        const result = notifications.map(n => ({
            id: n.id,
            title: n.title,
            message: n.message,
            type: n.type,
            createdAt: n.createdAt,
            sentBy: n.admin?.displayName || n.admin?.username || 'Admin',
            isRead: n.reads.length > 0
        }));

        res.json(result);
    } catch (err) {
        console.error('Get notifications error:', err);
        res.status(500).json({ error: 'Failed to fetch notifications' });
    }
});

// GET /api/notifications/unread-count — quick unread count
router.get('/unread-count', auth, async (req, res) => {
    try {
        const total = await prisma.notification.count();
        const read = await prisma.notificationRead.count({
            where: { userId: req.user.id }
        });
        res.json({ count: Math.max(0, total - read) });
    } catch (err) {
        res.status(500).json({ error: 'Failed to get count' });
    }
});

// POST /api/notifications/:id/read — mark a notification as read
router.post('/:id/read', auth, async (req, res) => {
    try {
        const notificationId = parseInt(req.params.id);
        await prisma.notificationRead.upsert({
            where: {
                notificationId_userId: {
                    notificationId,
                    userId: req.user.id
                }
            },
            create: { notificationId, userId: req.user.id },
            update: {}
        });
        res.json({ success: true });
    } catch (err) {
        console.error('Mark read error:', err);
        res.status(500).json({ error: 'Failed to mark as read' });
    }
});

// POST /api/notifications/read-all — mark ALL as read
router.post('/read-all', auth, async (req, res) => {
    try {
        const notifications = await prisma.notification.findMany({ select: { id: true } });

        await Promise.all(
            notifications.map(n =>
                prisma.notificationRead.upsert({
                    where: {
                        notificationId_userId: {
                            notificationId: n.id,
                            userId: req.user.id
                        }
                    },
                    create: { notificationId: n.id, userId: req.user.id },
                    update: {}
                })
            )
        );

        res.json({ success: true });
    } catch (err) {
        console.error('Mark all read error:', err);
        res.status(500).json({ error: 'Failed to mark all as read' });
    }
});

// POST /api/notifications/broadcast — Admin only: send to all users
router.post('/broadcast', auth, adminOnly, async (req, res) => {
    try {
        const { title, message, type = 'info' } = req.body;

        if (!title?.trim() || !message?.trim()) {
            return res.status(400).json({ error: 'Title and message are required' });
        }

        const validTypes = ['info', 'warning', 'success', 'alert'];
        if (!validTypes.includes(type)) {
            return res.status(400).json({ error: 'Invalid type' });
        }

        const notification = await prisma.notification.create({
            data: {
                title: title.trim(),
                message: message.trim(),
                type,
                sentBy: req.user.id
            },
            include: {
                admin: { select: { displayName: true, username: true } }
            }
        });

        // Emit to ALL connected users via Socket.IO
        const io = req.app.get('io');
        if (io) {
            io.emit('admin:notification', {
                id: notification.id,
                title: notification.title,
                message: notification.message,
                type: notification.type,
                createdAt: notification.createdAt,
                sentBy: notification.admin?.displayName || notification.admin?.username || 'Admin',
                isRead: false
            });
        }

        console.log(`📢 Admin broadcast sent: "${title}" to all users`);

        res.json({ success: true, notification });
    } catch (err) {
        console.error('Broadcast error:', err);
        res.status(500).json({ error: 'Failed to send broadcast' });
    }
});

export default router;
