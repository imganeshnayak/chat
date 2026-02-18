import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { createOrder, verifyPaymentSignature, fetchPayment } from '../config/razorpay.js';

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/payments/escrow/initiate - Create Razorpay order for escrow deposit
router.post('/escrow/initiate', auth, async (req, res) => {
    try {
        const { dealId } = req.body;

        if (!dealId) {
            return res.status(400).json({ error: 'Deal ID is required.' });
        }

        const deal = await prisma.escrowDeal.findUnique({
            where: { id: parseInt(dealId) }
        });

        if (!deal) {
            return res.status(404).json({ error: 'Escrow deal not found.' });
        }

        // Verify user is the client
        if (deal.clientId !== req.user.id) {
            return res.status(403).json({ error: 'Only the client can pay for this deal.' });
        }

        // Check if already paid
        if (deal.paymentStatus === 'paid') {
            return res.status(400).json({ error: 'Payment already completed for this deal.' });
        }

        // Create Razorpay order
        const order = await createOrder(
            deal.totalAmount,
            'INR',
            {
                type: 'escrow',
                dealId: deal.id,
                clientId: req.user.id,
                vendorId: deal.vendorId
            }
        );

        // Update deal with order ID
        await prisma.escrowDeal.update({
            where: { id: deal.id },
            data: { razorpayOrderId: order.id }
        });

        // Log payment creation
        await prisma.paymentLog.create({
            data: {
                type: 'escrow',
                entityId: deal.id,
                razorpayOrderId: order.id,
                amount: deal.totalAmount,
                currency: 'INR',
                status: 'created',
                metadata: { orderId: order.id }
            }
        });

        res.json({
            orderId: order.id,
            amount: order.amount, // in paise
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            dealId: deal.id,
            title: deal.title
        });
    } catch (err) {
        console.error('Initiate escrow payment error:', err);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
});

// POST /api/payments/verification/initiate - Create Razorpay order for verification fee
router.post('/verification/initiate', auth, async (req, res) => {
    try {
        const VERIFICATION_FEE = 109;

        // Check if user already verified
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { verified: true }
        });

        if (user?.verified) {
            return res.status(400).json({ error: 'You are already verified.' });
        }

        // Check for existing pending request
        let verificationRequest = await prisma.verificationRequest.findFirst({
            where: {
                userId: req.user.id,
                status: 'pending_payment'
            }
        });

        // Create new request if none exists
        if (!verificationRequest) {
            verificationRequest = await prisma.verificationRequest.create({
                data: {
                    userId: req.user.id,
                    paymentAmount: VERIFICATION_FEE,
                    status: 'pending_payment',
                    paymentStatus: 'pending'
                }
            });
        }

        // Create Razorpay order
        const order = await createOrder(
            VERIFICATION_FEE,
            'INR',
            {
                type: 'verification',
                requestId: verificationRequest.id,
                userId: req.user.id
            }
        );

        // Update request with order ID
        await prisma.verificationRequest.update({
            where: { id: verificationRequest.id },
            data: { razorpayOrderId: order.id }
        });

        // Log payment creation
        await prisma.paymentLog.create({
            data: {
                type: 'verification',
                entityId: verificationRequest.id,
                razorpayOrderId: order.id,
                amount: VERIFICATION_FEE,
                currency: 'INR',
                status: 'created',
                metadata: { orderId: order.id }
            }
        });

        res.json({
            orderId: order.id,
            amount: order.amount, // in paise
            currency: order.currency,
            key_id: process.env.RAZORPAY_KEY_ID,
            requestId: verificationRequest.id
        });
    } catch (err) {
        console.error('Initiate verification payment error:', err);
        res.status(500).json({ error: 'Failed to initiate payment.' });
    }
});

// POST /api/payments/verify - Verify payment after checkout
router.post('/verify', auth, async (req, res) => {
    try {
        const { orderId, paymentId, signature, type, entityId } = req.body;

        if (!orderId || !paymentId || !signature || !type || !entityId) {
            return res.status(400).json({ error: 'Missing required fields.' });
        }

        // Verify signature
        const isValid = verifyPaymentSignature(orderId, paymentId, signature);

        if (!isValid) {
            return res.status(400).json({ error: 'Invalid payment signature.' });
        }

        // Fetch payment details from Razorpay
        const payment = await fetchPayment(paymentId);

        if (payment.status !== 'captured' && payment.status !== 'authorized') {
            return res.status(400).json({ error: 'Payment not successful.' });
        }

        // Update based on type
        if (type === 'escrow') {
            const deal = await prisma.escrowDeal.findUnique({
                where: { id: parseInt(entityId) }
            });

            if (!deal) {
                return res.status(404).json({ error: 'Escrow deal not found.' });
            }

            if (deal.clientId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized.' });
            }

            // Update deal to active and paid
            await prisma.escrowDeal.update({
                where: { id: deal.id },
                data: {
                    razorpayPaymentId: paymentId,
                    paymentStatus: 'paid',
                    paidAmount: deal.totalAmount,
                    status: 'active' // Now active since payment is confirmed
                }
            });

            // Log successful payment
            await prisma.paymentLog.create({
                data: {
                    type: 'escrow',
                    entityId: deal.id,
                    razorpayOrderId: orderId,
                    razorpayPaymentId: paymentId,
                    amount: deal.totalAmount,
                    currency: 'INR',
                    status: 'paid',
                    metadata: payment
                }
            });

            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Paid for escrow deal',
                    details: `₹${deal.totalAmount} - ${deal.title}`
                }
            });

            res.json({ message: 'Payment verified successfully.', status: 'active' });

        } else if (type === 'verification') {
            const verificationRequest = await prisma.verificationRequest.findUnique({
                where: { id: parseInt(entityId) }
            });

            if (!verificationRequest) {
                return res.status(404).json({ error: 'Verification request not found.' });
            }

            if (verificationRequest.userId !== req.user.id) {
                return res.status(403).json({ error: 'Unauthorized.' });
            }

            // Update request to pending (waiting for admin review)
            await prisma.verificationRequest.update({
                where: { id: verificationRequest.id },
                data: {
                    razorpayPaymentId: paymentId,
                    paymentStatus: 'paid',
                    status: 'pending' // Now pending admin review
                }
            });

            // Log successful payment
            await prisma.paymentLog.create({
                data: {
                    type: 'verification',
                    entityId: verificationRequest.id,
                    razorpayOrderId: orderId,
                    razorpayPaymentId: paymentId,
                    amount: verificationRequest.paymentAmount,
                    currency: 'INR',
                    status: 'paid',
                    metadata: payment
                }
            });

            await prisma.activityLog.create({
                data: {
                    userId: req.user.id,
                    action: 'Paid for verification',
                    details: `₹${verificationRequest.paymentAmount}`
                }
            });

            res.json({ message: 'Payment verified successfully.', status: 'pending' });
        } else {
            return res.status(400).json({ error: 'Invalid payment type.' });
        }

    } catch (err) {
        console.error('Verify payment error:', err);
        res.status(500).json({ error: 'Failed to verify payment.' });
    }
});

// POST /api/payments/webhook - Handle Razorpay webhooks
router.post('/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
    try {
        // In production, verify webhook signature here
        // const signature = req.headers['x-razorpay-signature'];
        // verifyWebhookSignature(req.body, signature, webhookSecret);

        const event = req.body;

        if (event.event === 'payment.captured') {
            const paymentEntity = event.payload.payment.entity;
            const orderId = paymentEntity.order_id;
            const paymentId = paymentEntity.id;

            // Find associated escrow deal or verification request
            const deal = await prisma.escrowDeal.findFirst({
                where: { razorpayOrderId: orderId }
            });

            const verificationRequest = await prisma.verificationRequest.findFirst({
                where: { razorpayOrderId: orderId }
            });

            if (deal) {
                await prisma.escrowDeal.update({
                    where: { id: deal.id },
                    data: {
                        razorpayPaymentId: paymentId,
                        paymentStatus: 'paid',
                        paidAmount: deal.totalAmount,
                        status: 'active'
                    }
                });

                await prisma.paymentLog.create({
                    data: {
                        type: 'escrow',
                        entityId: deal.id,
                        razorpayOrderId: orderId,
                        razorpayPaymentId: paymentId,
                        amount: deal.totalAmount,
                        currency: 'INR',
                        status: 'paid',
                        eventType: 'payment.captured',
                        metadata: paymentEntity
                    }
                });
            } else if (verificationRequest) {
                await prisma.verificationRequest.update({
                    where: { id: verificationRequest.id },
                    data: {
                        razorpayPaymentId: paymentId,
                        paymentStatus: 'paid',
                        status: 'pending'
                    }
                });

                await prisma.paymentLog.create({
                    data: {
                        type: 'verification',
                        entityId: verificationRequest.id,
                        razorpayOrderId: orderId,
                        razorpayPaymentId: paymentId,
                        amount: verificationRequest.paymentAmount,
                        currency: 'INR',
                        status: 'paid',
                        eventType: 'payment.captured',
                        metadata: paymentEntity
                    }
                });
            }
        } else if (event.event === 'payment.failed') {
            const paymentEntity = event.payload.payment.entity;
            const orderId = paymentEntity.order_id;

            // Log failed payment
            await prisma.paymentLog.create({
                data: {
                    type: 'unknown',
                    entityId: 0,
                    razorpayOrderId: orderId,
                    amount: paymentEntity.amount / 100,
                    currency: paymentEntity.currency,
                    status: 'failed',
                    eventType: 'payment.failed',
                    metadata: paymentEntity
                }
            });
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});

export default router;
