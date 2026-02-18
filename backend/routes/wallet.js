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
        const transactions = await prisma.walletTransaction.findMany({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' },
            take: 50 // Limit to last 50 transactions
        });

        res.json(transactions);
    } catch (err) {
        console.error('Get wallet transactions error:', err);
        res.status(500).json({ error: 'Failed to fetch transactions' });
    }
});

// POST /api/wallet/payout/request - Create payout request
router.post('/payout/request', auth, async (req, res) => {
    try {
        const { amount, paymentMethod = 'bank', bankAccount, ifscCode, accountName, upiVpa } = req.body;

        if (!amount || amount < 500) {
            return res.status(400).json({ error: 'Minimum payout amount is ₹500' });
        }

        if (!accountName) {
            return res.status(400).json({ error: 'Account name is required' });
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
                    status: 'pending'
                }
            });

            return payoutRequest;
        });

        const io = req.app.get('io');
        sendUserNotification(
            io,
            req.user.id,
            '💸 Payout Requested',
            `Your payout request for ₹${amount.toLocaleString('en-IN')} has been submitted. It will be processed within 24-48 hours.`,
            'info'
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
        const requests = await prisma.payoutRequest.findMany({
            where: { userId: req.user.id },
            orderBy: { requestedAt: 'desc' }
        });

        res.json(requests);
    } catch (err) {
        console.error('Get payout requests error:', err);
        res.status(500).json({ error: 'Failed to fetch payout requests' });
    }
});

export default router;
