import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/moderation/block - Block a user
router.post('/block', auth, async (req, res) => {
    try {
        const { blockedId } = req.body;
        const blockerId = req.user.id;

        if (blockerId === parseInt(blockedId)) {
            return res.status(400).json({ error: "You cannot block yourself." });
        }

        const block = await prisma.blockedUser.upsert({
            where: {
                blockerId_blockedId: {
                    blockerId,
                    blockedId: parseInt(blockedId)
                }
            },
            update: {},
            create: {
                blockerId,
                blockedId: parseInt(blockedId)
            }
        });

        res.json({ message: "User blocked successfully.", block });
    } catch (err) {
        console.error('Block user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/moderation/block/:id - Unblock a user
router.delete('/block/:id', auth, async (req, res) => {
    try {
        const blockedId = parseInt(req.params.id);
        const blockerId = req.user.id;

        await prisma.blockedUser.delete({
            where: {
                blockerId_blockedId: {
                    blockerId,
                    blockedId
                }
            }
        });

        res.json({ message: "User unblocked successfully." });
    } catch (err) {
        console.error('Unblock user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/moderation/blocked - Get list of blocked users
router.get('/blocked', auth, async (req, res) => {
    try {
        const blocked = await prisma.blockedUser.findMany({
            where: { blockerId: req.user.id },
            include: {
                blocked: {
                    select: { id: true, username: true, displayName: true, avatarUrl: true }
                }
            }
        });
        res.json(blocked.map(b => b.blocked));
    } catch (err) {
        console.error('Get blocked users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/moderation/report - Report a user
router.post('/report', auth, async (req, res) => {
    try {
        const { reportedId, reason } = req.body;
        const reporterId = req.user.id;

        if (!reason || reason.trim().length < 5) {
            return res.status(400).json({ error: "Please provide a valid reason (min 5 chars)." });
        }

        const report = await prisma.report.create({
            data: {
                reporterId,
                reportedId: parseInt(reportedId),
                reason: reason.trim()
            }
        });

        res.json({ message: "Report submitted successfully.", report });
    } catch (err) {
        console.error('Report user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
