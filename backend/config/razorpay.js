import Razorpay from 'razorpay';
import crypto from 'crypto';

// Initialize Razorpay instance (only if keys are configured)
let razorpay = null;

if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
    razorpay = new Razorpay({
        key_id: process.env.RAZORPAY_KEY_ID,
        key_secret: process.env.RAZORPAY_KEY_SECRET
    });
    console.log('✅ Razorpay payments service initialized');
} else {
    console.warn('⚠️ Razorpay keys not configured — payment features will be disabled');
}

function ensureRazorpay() {
    if (!razorpay) throw new Error('Razorpay is not configured. Please add RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET.');
}

/**
 * Create a Razorpay order
 * @param {number} amount - Amount in smallest currency unit (paise for INR)
 * @param {string} currency - Currency code (default: INR)
 * @param {object} notes - Additional notes/metadata
 * @returns {Promise<object>} Razorpay order object
 */
export async function createOrder(amount, currency = 'INR', notes = {}) {
    ensureRazorpay();
    try {
        const options = {
            amount: Math.round(amount * 100), // Convert to paise
            currency,
            receipt: `receipt_${Date.now()}`,
            notes
        };

        const order = await razorpay.orders.create(options);
        return order;
    } catch (error) {
        console.error('Razorpay create order error:', error);
        throw new Error('Failed to create payment order');
    }
}

/**
 * Verify Razorpay payment signature
 * @param {string} orderId - Razorpay order ID
 * @param {string} paymentId - Razorpay payment ID
 * @param {string} signature - Signature sent by Razorpay
 * @returns {boolean} True if signature is valid
 */
export function verifyPaymentSignature(orderId, paymentId, signature) {
    try {
        const text = `${orderId}|${paymentId}`;
        const expectedSignature = crypto
            .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
            .update(text)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('Signature verification error:', error);
        return false;
    }
}

/**
 * Verify webhook signature
 * @param {string} webhookBody - Raw request body as string
 * @param {string} signature - X-Razorpay-Signature header value
 * @param {string} webhookSecret - Webhook secret from Razorpay dashboard
 * @returns {boolean} True if webhook is authentic
 */
export function verifyWebhookSignature(webhookBody, signature, webhookSecret) {
    try {
        const expectedSignature = crypto
            .createHmac('sha256', webhookSecret)
            .update(webhookBody)
            .digest('hex');

        return expectedSignature === signature;
    } catch (error) {
        console.error('Webhook signature verification error:', error);
        return false;
    }
}

/**
 * Fetch payment details
 * @param {string} paymentId - Razorpay payment ID
 * @returns {Promise<object>} Payment details
 */
export async function fetchPayment(paymentId) {
    ensureRazorpay();
    try {
        const payment = await razorpay.payments.fetch(paymentId);
        return payment;
    } catch (error) {
        console.error('Fetch payment error:', error);
        throw new Error('Failed to fetch payment details');
    }
}

/**
 * Capture a payment (for authorized payments)
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to capture in paise
 * @returns {Promise<object>} Captured payment object
 */
export async function capturePayment(paymentId, amount) {
    ensureRazorpay();
    try {
        const payment = await razorpay.payments.capture(paymentId, Math.round(amount * 100));
        return payment;
    } catch (error) {
        console.error('Capture payment error:', error);
        throw new Error('Failed to capture payment');
    }
}

/**
 * Refund a payment
 * @param {string} paymentId - Razorpay payment ID
 * @param {number} amount - Amount to refund (optional, full refund if not provided)
 * @returns {Promise<object>} Refund object
 */
export async function refundPayment(paymentId, amount = null) {
    ensureRazorpay();
    try {
        const options = amount ? { amount: Math.round(amount * 100) } : {};
        const refund = await razorpay.payments.refund(paymentId, options);
        return refund;
    } catch (error) {
        console.error('Refund payment error:', error);
        throw new Error('Failed to process refund');
    }
}

export default razorpay;
