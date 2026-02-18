import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';
import { createOrder, verifyPaymentSignature, fetchPayment } from '../config/razorpay.js';
import { sendUserNotification } from './notifications.js';

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

        // Check if this payment has already been processed (prevent duplicates)
        // We use a transaction and attempt to create the log first to ensure atomicity
        try {
            await prisma.$transaction(async (tx) => {
                const numericEntityId = parseInt(entityId);

                // 1. Fetch the relevant entity to get the amount
                let amount = 0;
                if (type === 'escrow') {
                    const deal = await tx.escrowDeal.findUnique({ where: { id: numericEntityId } });
                    if (!deal) throw new Error('Escrow deal not found');
                    if (deal.clientId !== req.user.id) throw new Error('Unauthorized');
                    amount = deal.totalAmount;
                } else if (type === 'verification') {
                    const verificationRequest = await tx.verificationRequest.findUnique({ where: { id: numericEntityId } });
                    if (!verificationRequest) throw new Error('Verification request not found');
                    if (verificationRequest.userId !== req.user.id) throw new Error('Unauthorized');
                    amount = verificationRequest.paymentAmount;
                } else {
                    throw new Error('Invalid payment type');
                }

                // 2. Create the PaymentLog (this will fail if razorpayPaymentId is already registered)
                await tx.paymentLog.create({
                    data: {
                        type,
                        entityId: numericEntityId,
                        razorpayOrderId: orderId,
                        razorpayPaymentId: paymentId,
                        amount,
                        currency: 'INR',
                        status: 'paid',
                        metadata: payment
                    }
                });

                // 3. Update the entity and log activity
                if (type === 'escrow') {
                    const deal = await tx.escrowDeal.findUnique({ where: { id: numericEntityId } });
                    await tx.escrowDeal.update({
                        where: { id: numericEntityId },
                        data: {
                            razorpayPaymentId: paymentId,
                            paymentStatus: 'paid',
                            paidAmount: deal.totalAmount,
                            status: 'active'
                        }
                    });

                    await tx.activityLog.create({
                        data: {
                            userId: req.user.id,
                            action: 'Paid for escrow deal',
                            details: `₹${deal.totalAmount} - ${deal.title}`
                        }
                    });

                    // Send notifications
                    const io = req.app.get('io');
                    sendUserNotification(io, req.user.id, '✅ Payment Successful', `Your payment of ₹${deal.totalAmount.toLocaleString('en-IN')} for "${deal.title}" was successful. The deal is now active.`, 'success');
                    sendUserNotification(io, deal.vendorId, '💰 Payment Received', `A client paid ₹${deal.totalAmount.toLocaleString('en-IN')} for the deal "${deal.title}". You can now start the work.`, 'success');

                } else if (type === 'verification') {
                    const verificationRequest = await tx.verificationRequest.findUnique({ where: { id: numericEntityId } });
                    await tx.verificationRequest.update({
                        where: { id: numericEntityId },
                        data: {
                            razorpayPaymentId: paymentId,
                            paymentStatus: 'paid',
                            status: 'pending'
                        }
                    });

                    await tx.activityLog.create({
                        data: {
                            userId: req.user.id,
                            action: 'Paid for verification',
                            details: `₹${verificationRequest.paymentAmount}`
                        }
                    });

                    const io = req.app.get('io');
                    sendUserNotification(io, req.user.id, '🛡️ Verification Payment Received', `We received your payment for verification. Our team will review your account shortly.`, 'success');
                }
            });

            return res.json({ message: 'Payment verified successfully.' });

        } catch (err) {
            if (err.code === 'P2002') {
                console.log(`ℹ️ Payment ${paymentId} already processed (manual verify)`);
                return res.json({ message: 'Payment already processed.', status: 'already_processed' });
            }
            if (err.message === 'Unauthorized') return res.status(403).json({ error: 'Unauthorized.' });
            if (err.message.includes('not found')) return res.status(404).json({ error: err.message });
            if (err.message === 'Invalid payment type') return res.status(400).json({ error: err.message });

            throw err; // Let outer catch handle it
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

            try {
                const result = await prisma.$transaction(async (tx) => {
                    // Try to create the payment log (idempotency anchor)
                    const deal = await tx.escrowDeal.findFirst({ where: { razorpayOrderId: orderId } });
                    const verificationRequest = await tx.verificationRequest.findFirst({ where: { razorpayOrderId: orderId } });

                    if (!deal && !verificationRequest) return null; // Ignore unknown orders

                    await tx.paymentLog.create({
                        data: {
                            type: deal ? 'escrow' : 'verification',
                            entityId: deal ? deal.id : verificationRequest.id,
                            razorpayOrderId: orderId,
                            razorpayPaymentId: paymentId,
                            amount: deal ? deal.totalAmount : verificationRequest.paymentAmount,
                            currency: 'INR',
                            status: 'paid',
                            eventType: 'payment.captured',
                            metadata: paymentEntity
                        }
                    });

                    if (deal) {
                        await tx.escrowDeal.update({
                            where: { id: deal.id },
                            data: {
                                razorpayPaymentId: paymentId,
                                paymentStatus: 'paid',
                                paidAmount: deal.totalAmount,
                                status: 'active'
                            }
                        });
                        return { type: 'escrow', deal };
                    } else if (verificationRequest) {
                        await tx.verificationRequest.update({
                            where: { id: verificationRequest.id },
                            data: {
                                razorpayPaymentId: paymentId,
                                paymentStatus: 'paid',
                                status: 'pending'
                            }
                        });
                        return { type: 'verification', request: verificationRequest };
                    }
                });

                // Send notifications AFTER transaction commits
                if (result) {
                    const io = req.app.get('io');
                    if (result.type === 'escrow') {
                        sendUserNotification(io, result.deal.clientId, '✅ Payment Successful', `Your payment of ₹${result.deal.totalAmount.toLocaleString('en-IN')} for "${result.deal.title}" was successful.`, 'success');
                        sendUserNotification(io, result.deal.vendorId, '💰 Payment Received', `Payment for "${result.deal.title}" was received. You can now start the work.`, 'success');
                    } else if (result.type === 'verification') {
                        sendUserNotification(io, result.request.userId, '🛡️ Verification Payment Received', `Your verification payment was received.`, 'success');
                    }
                }

            } catch (err) {
                if (err.code === 'P2002') {
                    console.log(` Payment ${paymentId} already processed (webhook)`);
                    return res.json({ status: 'already_processed' });
                }
                throw err;
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

            const io = req.app.get('io');
            // Try to notify user if we can find the order
            const deal = await prisma.escrowDeal.findFirst({
                where: { razorpayOrderId: orderId }
            });
            if (deal) {
                sendUserNotification(io, deal.clientId, '❌ Payment Failed', `Your payment of ₹${deal.totalAmount.toLocaleString('en-IN')} for "${deal.title}" failed.`, 'alert');
            } else {
                const verificationRequest = await prisma.verificationRequest.findFirst({
                    where: { razorpayOrderId: orderId }
                });
                if (verificationRequest) {
                    sendUserNotification(io, verificationRequest.userId, '❌ Payment Failed', `Your verification payment failed.`, 'alert');
                }
            }
        }

        res.json({ status: 'ok' });
    } catch (err) {
        console.error('Webhook error:', err);
        res.status(500).json({ error: 'Webhook processing failed.' });
    }
});

export default router;
