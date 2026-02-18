import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/escrow - Get all escrow deals for current user
router.get('/', auth, async (req, res) => {
    try {
        const deals = await prisma.escrowDeal.findMany({
            where: {
                OR: [
                    { clientId: req.user.id },
                    { vendorId: req.user.id }
                ]
            },
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(deals);
    } catch (err) {
        console.error('Get escrow deals error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/escrow/:id - Get specific escrow deal
router.get('/:id', auth, async (req, res) => {
    try {
        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(req.params.id) },
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Check if user is part of this deal
        if (deal.clientId !== req.user.id && deal.vendorId !== req.user.id) {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        res.json(deal);
    } catch (err) {
        console.error('Get escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow - Create new escrow deal
router.post('/', auth, async (req, res) => {
    try {
        const { chatId, vendorId, title, description, totalAmount } = req.body;

        if (!chatId || !vendorId || !title || !totalAmount) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        if (totalAmount <= 0) {
            return res.status(400).json({ error: 'Total amount must be greater than 0.' });
        }

        // Security: Validate chatId format (should be 'chat_userId1_userId2' or 'chat_userId1_userId2_timestamp')
        if (!chatId.startsWith('chat_')) {
            return res.status(400).json({ error: 'Invalid chat ID format.' });
        }

        // Extract user IDs from chatId (format: chat_1_2 or chat_1_2_1234567890)
        const chatParts = chatId.split('_');
        if (chatParts.length < 3 || chatParts.length > 4) {
            return res.status(400).json({ error: 'Invalid chat ID format.' });
        }

        const chatUserIds = [parseInt(chatParts[1]), parseInt(chatParts[2])].sort();
        const currentUserId = req.user.id;
        const requestedVendorId = parseInt(vendorId);

        // Security: Verify current user is part of this chat
        if (!chatUserIds.includes(currentUserId)) {
            return res.status(403).json({ error: 'You are not a participant in this chat.' });
        }

        // Security: Verify vendor exists
        const vendor = await prisma.user.findUnique({
            where: { id: requestedVendorId }
        });

        if (!vendor) {
            return res.status(404).json({ error: 'Vendor not found. Please double check the User ID.' });
        }

        // Security: Verify vendor is the other participant in the chat
        if (!chatUserIds.includes(requestedVendorId)) {
            return res.status(403).json({ error: 'Vendor must be a participant in this chat.' });
        }

        // Prevent creating deal with yourself
        if (requestedVendorId === currentUserId) {
            return res.status(400).json({ error: 'Cannot create escrow deal with yourself.' });
        }

        const deal = await prisma.escrowDeal.create({
            data: {
                chatId,
                clientId: req.user.id,
                vendorId: requestedVendorId,
                title,
                description: description || '',
                totalAmount: parseFloat(totalAmount),
                status: 'active'
            },
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: true
            }
        });

        await prisma.activityLog.create({
            data: { userId: req.user.id, action: 'Created escrow deal', details: title }
        });

        res.status(201).json(deal);
    } catch (err) {
        console.error('Create escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/escrow/:id/release - Release payment
router.post('/:id/release', auth, async (req, res) => {
    try {
        const { percent, note } = req.body;
        const dealId = parseInt(req.params.id);

        if (!percent || percent <= 0 || percent > 100) {
            return res.status(400).json({ error: 'Invalid percentage.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Only client can release payment
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can release payment.' });
        }

        // Check if deal is active
        if (deal.status !== 'active') {
            return res.status(400).json({ error: 'Deal is not active.' });
        }

        // Check if trying to release more than available
        const newReleasedPercent = deal.releasedPercent + parseFloat(percent);
        if (newReleasedPercent > 100) {
            return res.status(400).json({
                error: `Cannot release ${percent}%. Only ${100 - deal.releasedPercent}% remaining.`
            });
        }

        const amount = (deal.totalAmount * parseFloat(percent)) / 100;
        const platformFee = amount * 0.05;
        const vendorAmount = amount - platformFee;

        // Perform updates in a transaction
        const [transaction, updatedDeal, updatedVendor] = await prisma.$transaction(async (prisma) => {
            // 1. Create escrow transaction record
            const tx = await prisma.escrowTransaction.create({
                data: {
                    dealId,
                    percent: parseFloat(percent),
                    amount,
                    note: note || 'Payment released'
                }
            });

            // 2. Update deal status
            const dealUpdate = await prisma.escrowDeal.update({
                where: { id: dealId },
                data: {
                    releasedPercent: newReleasedPercent,
                    status: newReleasedPercent >= 100 ? 'completed' : 'active'
                },
                include: {
                    client: {
                        select: { id: true, displayName: true, avatarUrl: true, username: true }
                    },
                    vendor: {
                        select: { id: true, displayName: true, avatarUrl: true, username: true }
                    },
                    transactions: {
                        orderBy: { createdAt: 'asc' }
                    }
                }
            });

            // 3. Credit vendor wallet (95%)
            const vendorUpdate = await prisma.user.update({
                where: { id: deal.vendorId },
                data: { walletBalance: { increment: vendorAmount } }
            });

            // 4. Log wallet transaction for vendor
            await prisma.walletTransaction.create({
                data: {
                    userId: deal.vendorId,
                    type: 'escrow_release',
                    amount: vendorAmount,
                    balance: vendorUpdate.walletBalance,
                    reference: `deal_${dealId}`,
                    description: `Escrow release: ${deal.title} (${percent}%) - Fees: ₹${platformFee}`
                }
            });

            // 5. Log activity
            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Released escrow payment',
                    details: `${percent}% - ${deal.title}`
                }
            });

            return [tx, dealUpdate, vendorUpdate];
        });

        // Emit socket event for real-time update
        const io = req.app.get('io');
        if (io) {
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
        }

        res.json(updatedDeal);
    } catch (err) {
        console.error('Release payment error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/escrow/:id - Update escrow deal
router.put('/:id', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { title, description, status } = req.body;

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found.' });
        }

        // Only client can update deal
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can update the deal.' });
        }

        const updateData = {};
        if (title !== undefined) updateData.title = title;
        if (description !== undefined) updateData.description = description;
        if (status !== undefined && ['active', 'completed', 'cancelled'].includes(status)) {
            updateData.status = status;
        }

        const updatedDeal = await prisma.escrowDeal.update({
            where: { id: dealId },
            data: updateData,
            include: {
                client: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                vendor: {
                    select: { id: true, displayName: true, avatarUrl: true, username: true }
                },
                transactions: {
                    orderBy: { createdAt: 'asc' }
                }
            }
        });

        res.json(updatedDeal);
    } catch (err) {
        console.error('Update escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// DELETE /api/escrow/:id - Delete unpaid escrow deal
router.delete('/:id', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        // Only the client can delete
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can delete this deal' });
        }

        // Only allow deletion of unpaid deals
        if (deal.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Cannot delete a paid deal' });
        }

        await prisma.escrowDeal.delete({
            where: { id: dealId }
        });

        res.json({ success: true, message: 'Deal deleted successfully' });
    } catch (err) {
        console.error('Delete escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
