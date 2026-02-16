import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

const VERIFICATION_FEE = 109; // ₹109

// POST /api/verification/apply - Submit verification request
router.post('/apply', auth, async (req, res) => {
    try {
        const { paymentProof } = req.body;

        // Check if user is already verified
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { verified: true }
        });

        if (user?.verified) {
            return res.status(400).json({ error: 'You are already verified.' });
        }

        // Check if there's already a pending request
        const existingRequest = await prisma.verificationRequest.findFirst({
            where: {
                userId: req.user.id,
                status: 'pending'
            }
        });

        if (existingRequest) {
            return res.status(400).json({ error: 'You already have a pending verification request.' });
        }

        // Create new verification request
        const verificationRequest = await prisma.verificationRequest.create({
            data: {
                userId: req.user.id,
                paymentAmount: VERIFICATION_FEE,
                paymentProof: paymentProof || null,
                status: 'pending'
            }
        });

        res.json(verificationRequest);
    } catch (err) {
        console.error('Apply for verification error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/verification/status - Get current user's verification request status
router.get('/status', auth, async (req, res) => {
    try {
        const verificationRequest = await prisma.verificationRequest.findFirst({
            where: { userId: req.user.id },
            orderBy: { createdAt: 'desc' }
        });

        res.json(verificationRequest || null);
    } catch (err) {
        console.error('Get verification status error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/verification/fee - Get verification fee amount
router.get('/fee', auth, async (req, res) => {
    res.json({ fee: VERIFICATION_FEE, currency: 'INR' });
});

// GET /api/verification/requests - List all verification requests (admin only)
router.get('/requests', auth, adminOnly, async (req, res) => {
    try {
        const { status } = req.query;

        const where = status ? { status: status } : {};

        const requests = await prisma.verificationRequest.findMany({
            where,
            include: {
                user: {
                    select: {
                        id: true,
                        username: true,
                        displayName: true,
                        avatarUrl: true,
                        email: true
                    }
                }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json(requests);
    } catch (err) {
        console.error('List verification requests error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/verification/requests/:id/approve - Approve verification request (admin only)
router.put('/requests/:id/approve', auth, adminOnly, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);

        const verificationRequest = await prisma.verificationRequest.findUnique({
            where: { id: requestId }
        });

        if (!verificationRequest) {
            return res.status(404).json({ error: 'Verification request not found.' });
        }

        if (verificationRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Request has already been processed.' });
        }

        // Update request status and user verified status in a transaction
        await prisma.$transaction([
            prisma.verificationRequest.update({
                where: { id: requestId },
                data: {
                    status: 'approved',
                    reviewedAt: new Date()
                }
            }),
            prisma.user.update({
                where: { id: verificationRequest.userId },
                data: { verified: true }
            })
        ]);

        res.json({ message: 'Verification request approved successfully.' });
    } catch (err) {
        console.error('Approve verification request error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/verification/requests/:id/reject - Reject verification request (admin only)
router.put('/requests/:id/reject', auth, adminOnly, async (req, res) => {
    try {
        const requestId = parseInt(req.params.id);
        const { adminNote } = req.body;

        const verificationRequest = await prisma.verificationRequest.findUnique({
            where: { id: requestId }
        });

        if (!verificationRequest) {
            return res.status(404).json({ error: 'Verification request not found.' });
        }

        if (verificationRequest.status !== 'pending') {
            return res.status(400).json({ error: 'Request has already been processed.' });
        }

        await prisma.verificationRequest.update({
            where: { id: requestId },
            data: {
                status: 'rejected',
                adminNote: adminNote || null,
                reviewedAt: new Date()
            }
        });

        res.json({ message: 'Verification request rejected.' });
    } catch (err) {
        console.error('Reject verification request error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
