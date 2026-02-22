import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { sendUserNotification } from './notifications.js';

const prisma = new PrismaClient();
const router = express.Router();

// GET /api/wallet/balance - Get current wallet balance
router.get('/balance', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { walletBalance: true }
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found' });
        }

        res.json({ balance: user.walletBalance });
    } catch (err) {
        console.error('Get wallet balance error:', err);
        res.status(500).json({ error: 'Failed to fetch wallet balance' });
    }
});

// GET /api/wallet/transactions - Get wallet transaction history
router.get('/transactions', auth, async (req, res) => {
    try {
        const { type } = req.query;
        let where = req.user.role === 'admin' ? {} : { userId: req.user.id };

        if (type === 'sent') {
            where.amount = { lt: 0 };
        } else if (type === 'received') {
            where.type = 'escrow_release';
        } else if (type === 'added') {
            where.type = 'credit';
        }

        const transactions = await prisma.walletTransaction.findMany({
            where,
            orderBy: { createdAt: 'desc' },
            take: 100 // Increased limit
        });
        const dealCache = new Map();
        const chatDealCache = new Map();

        const getDealById = async (dealId) => {
            if (dealCache.has(dealId)) return dealCache.get(dealId);
            const deal = await prisma.escrowDeal.findUnique({
                where: { id: dealId },
                select: {
                    id: true,
                    title: true,
                    createdAt: true,
                    status: true,
                    totalAmount: true,
                    chatId: true,
                    client: { select: { id: true, displayName: true, username: true } },
                    vendor: { select: { id: true, displayName: true, username: true } }
                }
            });
            dealCache.set(dealId, deal);
            return deal;
        };

        const parseDealIdFromReference = (reference) => {
            if (!reference || typeof reference !== 'string') return null;
            if (reference.startsWith('deal_')) return parseInt(reference.replace('deal_', ''));
            if (reference.startsWith('refund_deal_')) return parseInt(reference.replace('refund_deal_', ''));
            return null;
        };

        const enriched = await Promise.all(transactions.map(async (tx) => {
            const metadata = tx.metadata || {};
            let deal = null;
            const dealId = metadata.dealId || parseDealIdFromReference(tx.reference);

            if (dealId) {
                deal = await getDealById(dealId);
            } else if (metadata.chatId && metadata.dealTitle) {
                const cacheKey = `${metadata.chatId}_${metadata.dealTitle}`;
                if (chatDealCache.has(cacheKey)) {
                    deal = chatDealCache.get(cacheKey);
                } else {
                    deal = await prisma.escrowDeal.findFirst({
                        where: { chatId: metadata.chatId, title: metadata.dealTitle },
                        orderBy: { createdAt: 'desc' },
                        select: {
                            id: true,
                            title: true,
                            createdAt: true,
                            status: true,
                            totalAmount: true,
                            chatId: true,
                            client: { select: { id: true, displayName: true, username: true } },
                            vendor: { select: { id: true, displayName: true, username: true } }
                        }
                    });
                    chatDealCache.set(cacheKey, deal);
                }
            }

            return { ...tx, deal };
        }));

        res.json(enriched);
    } catch (err) {
        console.error('Get wallet transactions error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// POST /api/wallet/payout/request - Create payout request
router.post('/payout/request', auth, async (req, res) => {
    try {
        const { amount, paymentMethod = 'bank', bankAccount, ifscCode, accountName, upiVpa, phoneNumber, email } = req.body;

        if (!amount || amount < 500) {
            return res.status(400).json({ error: 'Minimum payout amount is ₹500' });
        }

        if (!accountName) {
            return res.status(400).json({ error: 'Account holder name is required' });
        }

        if (!phoneNumber) {
            return res.status(400).json({ error: 'Phone number is required for admin contact' });
        }

        // Validate based on payment method
        if (paymentMethod === 'bank' && (!bankAccount || !ifscCode)) {
            return res.status(400).json({ error: 'Bank account and IFSC code are required for bank transfers' });
        }

        if (paymentMethod === 'upi' && (!upiVpa || !upiVpa.includes('@'))) {
            return res.status(400).json({ error: 'Valid UPI ID is required' });
        }

        // Check wallet balance
        const user = await prisma.user.findUnique({
            where: { id: req.user.id }
        });

        if (user.walletBalance < amount) {
            return res.status(400).json({ error: 'Insufficient wallet balance' });
        }

        // Start transaction
        const result = await prisma.$transaction(async (prisma) => {
            // Debit wallet
            const updatedUser = await prisma.user.update({
                where: { id: req.user.id },
                data: { walletBalance: { decrement: amount } }
            });

            // Log transaction
            await prisma.walletTransaction.create({
                data: {
                    userId: req.user.id,
                    type: 'payout',
                    amount: -amount,
                    balance: updatedUser.walletBalance,
                    description: `Payout Request via ${paymentMethod === 'upi' ? 'UPI' : 'Bank'}`,
                }
            });

            // Create request
            const payoutRequest = await prisma.payoutRequest.create({
                data: {
                    userId: req.user.id,
                    amount: parseFloat(amount),
                    paymentMethod,
                    bankAccount: paymentMethod === 'bank' ? bankAccount : null,
                    ifscCode: paymentMethod === 'bank' ? ifscCode : null,
                    accountName,
                    upiVpa: paymentMethod === 'upi' ? upiVpa : null,
                    status: 'pending',
                    phoneNumber,
                    email,
                    adminNote: phoneNumber ? `Contact: ${phoneNumber}${email ? ` | Email: ${email}` : ''}` : null
                }
            });

            return payoutRequest;
        });

        const io = req.app.get('io');
        sendUserNotification(
            io,
            req.user.id,
            '💸 Payout Requested',
            `Your payout request for ₹${amount.toLocaleString('en-IN')} has been submitted. It will be processed within 24-48 business hours.`,
            'info',
            { type: 'wallet' }
        );

        res.json(result);
    } catch (err) {
        console.error('Create payout request error:', err);
        res.status(500).json({ error: 'Failed to create payout request' });
    }
});

// GET /api/wallet/payout/requests - Get user's payout requests
router.get('/payout/requests', auth, async (req, res) => {
    try {
        const where = req.user.role === 'admin' ? {} : { userId: req.user.id };
        const requests = await prisma.payoutRequest.findMany({
            where,
            include: { user: { select: { username: true, displayName: true } } },
            orderBy: { requestedAt: 'desc' }
        });

        res.json(requests);
    } catch (err) {
        console.error('Get payout requests error:', err);
        res.status(500).json({ error: 'Failed to fetch payout requests' });
    }
});

export default router;
