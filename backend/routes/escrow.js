import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/escrow/platform-fee - Get current platform fee percentage
router.get('/platform-fee', auth, async (req, res) => {
    try {
        let platformFeePercent = 0.10; // Default
        const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);
        res.json({ platform_fee_percent: platformFeePercent });
    } catch (err) {
        console.error('Get platform fee error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/escrow - Get all escrow deals for current user
router.get('/', auth, async (req, res) => {
    try {
        const { chatId } = req.query;
        const where = {
            ...(chatId && { chatId }),
            ...(req.user.role !== 'admin' && {
                OR: [
                    { clientId: req.user.id },
                    { vendorId: req.user.id }
                ]
            })
        };

        const deals = await prisma.escrowDeal.findMany({
            where,
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
        if (req.user.role !== 'admin' && deal.clientId !== req.user.id && deal.vendorId !== req.user.id) {
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
        const { chatId, vendorId, title, description, terms, totalAmount } = req.body;

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

        // Prevent duplicate submissions (Check if an identical deal was created in the last 10 seconds)
        const recentDuplicate = await prisma.escrowDeal.findFirst({
            where: {
                chatId,
                clientId: req.user.id,
                vendorId: requestedVendorId,
                title,
                totalAmount: parseFloat(totalAmount),
                createdAt: {
                    gte: new Date(Date.now() - 10000) // 10 seconds ago
                }
            }
        });

        if (recentDuplicate) {
            return res.status(409).json({ error: 'A similar deal was recently created. Please wait a moment.' });
        }

        // Check user balance
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { walletBalance: true }
        });

        // Fetch platform fee from settings
        let platformFeePercent = 0.10; // Default
        const feeSetting = await prisma.systemSetting.findUnique({ where: { key: 'platform_fee_percent' } });
        if (feeSetting) platformFeePercent = parseFloat(feeSetting.value);

        const grossAmount = parseFloat(totalAmount);
        const feeAmount = grossAmount * platformFeePercent;
        const netAmount = grossAmount - feeAmount;

        const amountToDeduct = grossAmount;
        if (user.walletBalance < amountToDeduct) {
            return res.status(400).json({ error: `Insufficient wallet balance. You need ₹${amountToDeduct.toLocaleString('en-IN')} but only have ₹${user.walletBalance.toLocaleString('en-IN')}. Please add money to your wallet.` });
        }

        const result = await prisma.$transaction(async (tx) => {
            // 1. Deduct from wallet
            const updatedUser = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: amountToDeduct } }
            });

            // 2. Log wallet transaction
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'debit',
                    amount: -amountToDeduct,
                    balance: updatedUser.walletBalance,
                    description: `Escrow creation: ${title}`,
                    reference: chatId,
                    metadata: {
                        dealTitle: title,
                        chatId,
                        vendorId: requestedVendorId,
                        otherUserId: requestedVendorId,
                        otherDisplayName: vendor.displayName
                    }
                }
            });

            // 3. Create active escrow deal
            const newDeal = await tx.escrowDeal.create({
                data: {
                    chatId,
                    clientId: req.user.id,
                    vendorId: requestedVendorId,
                    title,
                    description: description || '',
                    terms: terms || '',
                    totalAmount: netAmount, // Store Net amount available for release
                    status: 'active',
                    paymentStatus: 'paid',
                    paidAmount: grossAmount // Store Gross amount paid by client
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

            // 4. Activity Log
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Created escrow deal (Wallet)',
                    details: `${title} - ₹${amountToDeduct}`
                }
            });

            // 5. System Message
            const systemMsg = await tx.message.create({
                data: {
                    senderId: currentUserId,
                    receiverId: requestedVendorId,
                    chatId,
                    content: `📋 New Escrow Deal: "${title}" for ₹${grossAmount.toLocaleString('en-IN')}. Funds deducted from client wallet and held in escrow. (Net available for release: ₹${netAmount.toLocaleString('en-IN')} after platform fee)`,
                    messageType: 'escrow_created'
                },
                include: {
                    sender: {
                        select: { displayName: true, avatarUrl: true, username: true }
                    }
                }
            });

            return { newDeal, systemMsg };
        });

        const io = req.app.get('io');
        if (io) {
            const socketResult = {
                ...result.systemMsg,
                sender_name: result.systemMsg.sender.displayName,
                sender_avatar: result.systemMsg.sender.avatarUrl,
                sender_username: result.systemMsg.sender.username,
            };
            io.to(chatId).emit('newMessage', socketResult);
            io.to(`user_${requestedVendorId}`).emit('newMessage', socketResult);

            // Also emit escrowUpdate
            io.to(chatId).emit('escrowUpdate', result.newDeal);
            io.to(`user_${requestedVendorId}`).emit('escrowUpdate', result.newDeal);
        }

        res.status(201).json(result.newDeal);
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
            where: { id: dealId },
            include: {
                client: { select: { id: true, displayName: true, username: true } },
                vendor: { select: { id: true, displayName: true, username: true } }
            }
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

        // PERFORM updates in a transaction
        // Use an atomic update first to ensure we don't exceed 100%
        const io = req.app.get('io');
        let updatedDeal, vendorNet;

        // Platform fee is now deducted at creation. totalAmount of the deal reflects the NET amount.
        try {
            // Re-think: updateMany doesn't return the updated record.
            // Let's use the transaction with a strictly serializable approach or the check.

            const result = await prisma.$transaction(async (tx) => {
                // 1. Fetch current deal with lock (if possible) or just verify condition
                // For valid race condition fix without raw Locking, we use the update count strategy.
                const userPercent = parseFloat(percent);

                // Attempt to update physically using a where clause that safeguards the invariant
                // "releasedPercent + userPercent <= 100"
                // We find the deal first to get current percent to construct the WHERE clause?
                // No, that defeats the purpose. "100 - userPercent" is constant for this request.
                // So: WHERE releasedPercent <= (100 - userPercent)
                const updateBatch = await tx.escrowDeal.updateMany({
                    where: {
                        id: dealId,
                        status: 'active',
                        releasedPercent: { lte: 100 - userPercent }
                    },
                    data: {
                        releasedPercent: { increment: userPercent }
                    }
                });

                if (updateBatch.count === 0) {
                    throw new Error('Release failed. Either deal is inactive or amount exceeds 100%.');
                }

                // Calculate amounts using totalAmount (which is Net)
                // Re-fetch deal inside transaction to ensure we have latest data for calculations
                const currentDeal = await tx.escrowDeal.findUnique({ where: { id: dealId } });

                vendorNet = (currentDeal.totalAmount * userPercent) / 100;
                const feeAmount = 0; // Already deducted at creation

                // 3. Create escrow transaction record
                await tx.escrowTransaction.create({
                    data: {
                        dealId,
                        percent: userPercent,
                        amount: vendorNet,
                        note: note || `Payment released (Platform fee already deducted at creation)`
                    }
                });

                // 4. Check if completed and update status
                if (currentDeal.releasedPercent >= 100) {
                    await tx.escrowDeal.update({
                        where: { id: dealId },
                        data: { status: 'completed' }
                    });
                    currentDeal.status = 'completed'; // Update local obj for response
                }

                // 5. Credit vendor wallet
                const venUp = await tx.user.update({
                    where: { id: deal.vendorId },
                    data: { walletBalance: { increment: vendorNet } }
                });

                // 6. Log wallet transaction for vendor
                await tx.walletTransaction.create({
                    data: {
                        userId: deal.vendorId,
                        type: 'escrow_release',
                        amount: vendorNet,
                        balance: venUp.walletBalance,
                        reference: `deal_${dealId}`,
                        description: `Escrow release: ${deal.title} (${userPercent}%).`,
                        metadata: {
                            dealId,
                            dealTitle: deal.title,
                            chatId: deal.chatId,
                            percent: userPercent,
                            otherUserId: deal.clientId,
                            otherDisplayName: deal.client.displayName
                        }
                    }
                });

                // 7. Log activity
                await tx.activityLog.create({
                    data: {
                        userId: req.user.id,
                        action: 'Released escrow payment',
                        details: `${userPercent}% - ${deal.title}`
                    }
                });

                // 8. Create a system message in the chat
                const systemMessage = await tx.message.create({
                    data: {
                        senderId: req.user.id,
                        receiverId: deal.vendorId,
                        chatId: deal.chatId,
                        content: `💰 Funds Released: ₹${vendorNet.toLocaleString('en-IN')} (${userPercent}%) released to vendor for "${deal.title}".`,
                        messageType: 'escrow_released'
                    },
                    include: {
                        sender: {
                            select: { displayName: true, avatarUrl: true, username: true }
                        }
                    }
                });

                if (io) {
                    const socketResult = {
                        ...systemMessage,
                        sender_name: systemMessage.sender.displayName,
                        sender_avatar: systemMessage.sender.avatarUrl,
                        sender_username: systemMessage.sender.username,
                    };
                    io.to(deal.chatId).emit('newMessage', socketResult);
                    io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                }

                return currentDeal;
            });

            updatedDeal = result;
        } catch (txErr) {
            // Check if it was our custom error
            if (txErr.message === 'Release failed. Either deal is inactive or amount exceeds 100%.') {
                return res.status(400).json({ error: txErr.message });
            }
            throw txErr;
        }

        if (io) {
            io.to(deal.chatId).emit('escrowUpdate', updatedDeal);
            io.to(`user_${deal.vendorId}`).emit('escrowUpdate', updatedDeal);
        }

        // Notify vendor about received funds
        sendUserNotification(
            io,
            deal.vendorId,
            '💰 Payment Released',
            `You received ₹${vendorNet.toLocaleString('en-IN')} from "${deal.title}".`,
            'success',
            { type: 'wallet', dealId, chatId: deal.chatId }
        );
        // If deal is completed, notify both parties
        if (updatedDeal.releasedPercent >= 100) {
            sendUserNotification(
                io,
                deal.clientId,
                '✅ Deal Completed',
                `Your escrow deal "${deal.title}" is now fully completed. All payments have been released.`,
                'success',
                { type: 'escrow', dealId, chatId: deal.chatId }
            );
            sendUserNotification(
                io,
                deal.vendorId,
                '✅ Deal Completed',
                `The escrow deal "${deal.title}" is now fully completed. All payments have been received.`,
                'success',
                { type: 'escrow', dealId, chatId: deal.chatId }
            );
        }

        res.json(updatedDeal);
    } catch (err) {
        console.error('Release escrow error:', err);
        res.status(500).json({ error: 'Failed to release escrow payment.' });
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

// DELETE /api/escrow/:id - Delete or Cancel/Refund escrow deal
router.delete('/:id', auth, async (req, res) => {
    try {
        const dealId = parseInt(req.params.id);
        const { reason } = req.body;

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: dealId }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Deal not found' });
        }

        // Only the client can delete/cancel their own deal
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can cancel this deal' });
        }

        // Handle Unpaid Deals (Delete)
        if (deal.paymentStatus !== 'paid') {
            await prisma.escrowDeal.delete({
                where: { id: dealId }
            });
            return res.json({ success: true, message: 'Deal deleted successfully' });
        }

        // Handle Paid Deals (Refund & Cancel)
        if (deal.status === 'completed' || deal.status === 'cancelled') {
            return res.status(400).json({ error: 'Cannot cancel a completed or already cancelled deal.' });
        }

        const refundableAmount = deal.totalAmount * (1 - (deal.releasedPercent / 100));
        const io = req.app.get('io');

        await prisma.$transaction(async (tx) => {
            // 1. Credit client wallet
            const updatedClient = await tx.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { increment: refundableAmount } }
            });

            // 2. Log wallet transaction
            await tx.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'credit',
                    amount: refundableAmount,
                    balance: updatedClient.walletBalance,
                    reference: `refund_deal_${dealId}`,
                    description: `Refund for cancelled escrow deal: ${deal.title}${reason ? ` (Reason: ${reason})` : ''}`
                }
            });

            // 3. Update deal status
            await tx.escrowDeal.update({
                where: { id: dealId },
                data: { status: 'cancelled' }
            });

            // 4. Log activity
            await tx.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Cancelled escrow deal & requested refund',
                    details: `${deal.title} - Refunded ₹${refundableAmount.toLocaleString('en-IN')}${reason ? ` | Reason: ${reason}` : ''}`
                }
            });

            // 5. Create a system message in the chat
            const systemMessage = await tx.message.create({
                data: {
                    senderId: req.user.id,
                    receiverId: deal.vendorId,
                    chatId: deal.chatId,
                    content: `❌ Escrow Cancelled & Refunded: The deal "${deal.title}" was cancelled by the client. ₹${refundableAmount.toLocaleString('en-IN')} has been returned to the client's wallet.${reason ? `\n\nReason: ${reason}` : ''}`,
                    messageType: 'escrow_cancelled'
                },
                include: {
                    sender: {
                        select: { displayName: true, avatarUrl: true, username: true }
                    }
                }
            });

            if (io) {
                const socketResult = {
                    ...systemMessage,
                    sender_name: systemMessage.sender.displayName,
                    sender_avatar: systemMessage.sender.avatarUrl,
                    sender_username: systemMessage.sender.username,
                };
                io.to(deal.chatId).emit('newMessage', socketResult);
                io.to(`user_${deal.vendorId}`).emit('newMessage', socketResult);
                io.to(`user_${deal.clientId}`).emit('newMessage', socketResult);
            }
        });

        // Notifications
        sendUserNotification(io, deal.clientId, '💰 Refund Processed', `₹${refundableAmount.toLocaleString('en-IN')} has been returned to your wallet for the deal "${deal.title}".`, 'success', { type: 'wallet' });
        sendUserNotification(io, deal.vendorId, '❌ Deal Cancelled', `The escrow deal "${deal.title}" was cancelled by the client. Any unreleased funds have been refunded.`, 'alert', { type: 'escrow', dealId, chatId: deal.chatId });

        res.json({ success: true, message: 'Deal cancelled and funds refunded successfully.' });
    } catch (err) {
        console.error('Cancel escrow deal error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
