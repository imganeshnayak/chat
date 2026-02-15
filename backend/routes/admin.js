import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/admin/stats - Dashboard statistics
router.get('/stats', auth, adminOnly, async (req, res) => {
    try {
        const [
            totalUsers,
            activeUsers,
            totalMessages,
            totalChats,
            totalEscrowDeals,
            activeEscrowDeals,
            totalEscrowValue,
            recentActivity
        ] = await Promise.all([
            prisma.user.count(),
            prisma.user.count({ where: { status: 'active' } }),
            prisma.message.count(),
            prisma.message.groupBy({
                by: ['chatId'],
                _count: true
            }),
            prisma.escrowDeal.count(),
            prisma.escrowDeal.count({ where: { status: 'active' } }),
            prisma.escrowDeal.aggregate({
                _sum: { totalAmount: true }
            }),
            prisma.activityLog.count({
                where: { createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } }
            })
        ]);

        res.json({
            totalUsers,
            activeUsers,
            totalMessages,
            totalChats: totalChats.length,
            totalEscrowDeals,
            activeEscrowDeals,
            totalEscrowValue: totalEscrowValue._sum.totalAmount || 0,
            recentActivity
        });
    } catch (err) {
        console.error('Stats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/reports - Get all reports
router.get('/reports', auth, adminOnly, async (req, res) => {
    try {
        const reports = await prisma.report.findMany({
            include: {
                reporter: { select: { id: true, username: true, displayName: true } },
                reported: { select: { id: true, username: true, displayName: true } }
            },
            orderBy: { createdAt: 'desc' }
        });
        res.json({ reports });
    } catch (err) {
        console.error('Get reports error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/reports/:id - Update report status
router.put('/reports/:id', auth, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        if (!['pending', 'resolved', 'dismissed'].includes(status)) {
            return res.status(400).json({ error: "Invalid status." });
        }

        const report = await prisma.report.update({
            where: { id: parseInt(req.params.id) },
            data: { status }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Updated report status',
                details: `Report ID: ${report.id}, Status: ${status}`
            }
        });

        res.json({ message: "Report updated successfully.", report });
    } catch (err) {
        console.error('Update report error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/users - Get all users with pagination
router.get('/users', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, search = '', status = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = {
            AND: [
                search ? {
                    OR: [
                        { username: { contains: search, mode: 'insensitive' } },
                        { email: { contains: search, mode: 'insensitive' } },
                        { displayName: { contains: search, mode: 'insensitive' } }
                    ]
                } : {},
                status ? { status } : {}
            ]
        };

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                select: {
                    id: true,
                    username: true,
                    email: true,
                    displayName: true,
                    avatarUrl: true,
                    role: true,
                    status: true,
                    createdAt: true,
                    _count: {
                        select: {
                            sentMessages: true,
                            clientDeals: true,
                            vendorDeals: true
                        }
                    }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.user.count({ where })
        ]);

        res.json({
            users,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/chats - Get all chats
router.get('/chats', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        // Get unique chat IDs with message counts
        const chatGroups = await prisma.message.groupBy({
            by: ['chatId'],
            _count: { id: true },
            _max: { createdAt: true },
            orderBy: { _max: { createdAt: 'desc' } },
            skip,
            take: parseInt(limit)
        });

        // Get participants for each chat
        const chatsWithDetails = await Promise.all(
            chatGroups.map(async (group) => {
                const messages = await prisma.message.findMany({
                    where: { chatId: group.chatId },
                    include: {
                        sender: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                        receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true } }
                    },
                    take: 1,
                    orderBy: { createdAt: 'desc' }
                });

                const participants = messages.length > 0
                    ? [messages[0].sender, messages[0].receiver]
                    : [];

                return {
                    chatId: group.chatId,
                    messageCount: group._count.id,
                    lastActivity: group._max.createdAt,
                    participants
                };
            })
        );

        const total = await prisma.message.groupBy({
            by: ['chatId'],
            _count: true
        });

        res.json({
            chats: chatsWithDetails,
            total: total.length,
            page: parseInt(page),
            totalPages: Math.ceil(total.length / parseInt(limit))
        });
    } catch (err) {
        console.error('Get chats error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/chats/:chatId/messages - Get all messages for a chat
router.get('/chats/:chatId/messages', auth, adminOnly, async (req, res) => {
    try {
        const { chatId } = req.params;
        const messages = await prisma.message.findMany({
            where: { chatId },
            include: {
                sender: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                receiver: { select: { id: true, displayName: true, avatarUrl: true, username: true } }
            },
            orderBy: { createdAt: 'asc' }
        });
        res.json(messages);
    } catch (err) {
        console.error('Get chat messages error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/escrow - Get all escrow deals
router.get('/escrow', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 20, status = '' } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const where = status ? { status } : {};

        const [deals, total] = await Promise.all([
            prisma.escrowDeal.findMany({
                where,
                include: {
                    client: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    vendor: { select: { id: true, displayName: true, avatarUrl: true, username: true } },
                    transactions: { orderBy: { createdAt: 'desc' }, take: 3 }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.escrowDeal.count({ where })
        ]);

        res.json({
            deals,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Get escrow deals error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/admin/activity-logs - Get activity logs
router.get('/activity-logs', auth, adminOnly, async (req, res) => {
    try {
        const { page = 1, limit = 50 } = req.query;
        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [activities, total] = await Promise.all([
            prisma.activityLog.findMany({
                include: {
                    user: { select: { displayName: true, username: true, avatarUrl: true } }
                },
                orderBy: { createdAt: 'desc' },
                skip,
                take: parseInt(limit)
            }),
            prisma.activityLog.count()
        ]);

        res.json({
            activities,
            total,
            page: parseInt(page),
            totalPages: Math.ceil(total / parseInt(limit))
        });
    } catch (err) {
        console.error('Activity logs error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/users/:id/status - Update user status
router.put('/users/:id/status', auth, adminOnly, async (req, res) => {
    try {
        const { status } = req.body;
        const userId = parseInt(req.params.id);

        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ error: 'Invalid status' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { status },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                status: true
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: `Changed user status to ${status}`,
                details: `User: ${user.username}`
            }
        });

        res.json(user);
    } catch (err) {
        console.error('Update user status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/admin/users/:id/role - Update user role
router.put('/users/:id/role', auth, adminOnly, async (req, res) => {
    try {
        const { role } = req.body;
        const userId = parseInt(req.params.id);

        if (!['client', 'vendor', 'admin'].includes(role)) {
            return res.status(400).json({ error: 'Invalid role' });
        }

        const user = await prisma.user.update({
            where: { id: userId },
            data: { role },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                role: true
            }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: `Changed user role to ${role}`,
                details: `User: ${user.username}`
            }
        });

        res.json(user);
    } catch (err) {
        console.error('Update user role error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/admin/users/:id - Delete user
router.delete('/users/:id', auth, adminOnly, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);

        // Prevent deleting yourself
        if (userId === req.user.id) {
            return res.status(400).json({ error: 'Cannot delete your own account' });
        }

        await prisma.user.delete({
            where: { id: userId }
        });

        await prisma.activityLog.create({
            data: {
                userId: req.user.id,
                action: 'Deleted user account',
                details: `User ID: ${userId}`
            }
        });

        res.json({ success: true });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

function getRelativeTime(date) {
    const diff = Date.now() - new Date(date).getTime();
    const minutes = Math.floor(diff / 60000);
    if (minutes < 1) return 'just now';
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default router;
