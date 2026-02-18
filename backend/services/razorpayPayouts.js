import Razorpay from 'razorpay';
import { PrismaClient } from '@prisma/client';
import axios from 'axios';

const prisma = new PrismaClient();

// Initialize Razorpay for Payouts
const razorpay = new Razorpay({
    key_id: process.env.RAZORPAY_KEY_ID,
    key_secret: process.env.RAZORPAY_KEY_SECRET
});

// Create axios instance for RazorpayX API (Payouts)
const razorpayAPI = axios.create({
    baseURL: 'https://api.razorpay.com/v1',
    auth: {
        username: process.env.RAZORPAY_KEY_ID,
        password: process.env.RAZORPAY_KEY_SECRET
    },
    headers: {
        'Content-Type': 'application/json',
        'X-Payout-Idempotency': '' // Will be set per request if needed
    }
});

/**
 * Create or get Razorpay contact for a user
 */
export async function getOrCreateContact(user) {
    try {
        // Check if user already has a contact ID
        if (user.razorpayContactId) {
            try {
                // Verify contact still exists
                const response = await razorpayAPI.get(`/contacts/${user.razorpayContactId}`);
                return user.razorpayContactId;
            } catch (err) {
                // Contact doesn't exist, create new one
                console.log('Contact not found, creating new one');
            }
        }

        // Create new contact
        const contactData = {
            name: user.displayName || user.username,
            email: user.email,
            contact: user.phoneNumber || '9999999999', // Uses actual phone if available
            type: 'vendor',
            reference_id: `user_${user.id}`,
            notes: {
                user_id: user.id.toString(),
                username: user.username
            }
        };

        const response = await razorpayAPI.post('/contacts', contactData);
        const contact = response.data;

        // Save contact ID to user
        await prisma.user.update({
            where: { id: user.id },
            data: { razorpayContactId: contact.id }
        });

        console.log(`✅ Created Razorpay contact: ${contact.id} for user ${user.id}`);
        return contact.id;
    } catch (err) {
        console.error('Create contact error:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
        });
        throw new Error(`Failed to create Razorpay contact: ${err.response?.data?.error?.description || err.message}`);
    }
}

/**
 * Create fund account for bank or UPI
 */
export async function createFundAccount(payoutRequest, contactId) {
    try {
        const { paymentMethod, accountName, bankAccount, ifscCode, upiVpa } = payoutRequest;

        const fundAccountData = {
            contact_id: contactId,
            account_type: paymentMethod === 'upi' ? 'vpa' : 'bank_account'
        };

        if (paymentMethod === 'upi') {
            // UPI fund account
            fundAccountData.vpa = {
                address: upiVpa // e.g., user@paytm
            };
        } else {
            // Bank account fund account
            fundAccountData.bank_account = {
                name: accountName,
                account_number: bankAccount,
                ifsc: ifscCode
            };
        }

        const response = await razorpayAPI.post('/fund_accounts', fundAccountData);
        const fundAccount = response.data;

        console.log(`✅ Created fund account: ${fundAccount.id} (${paymentMethod})`);

        return fundAccount.id;
    } catch (err) {
        console.error('Create fund account error:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
        });
        throw new Error(`Failed to create fund account: ${err.response?.data?.error?.description || err.message}`);
    }
}

/**
 * Create payout (actual money transfer)
 */
export async function createPayout(payoutRequest, fundAccountId) {
    try {
        const { id, amount, paymentMethod } = payoutRequest;

        // Determine payout mode
        let mode = 'IMPS'; // Default for bank accounts (fastest)
        if (paymentMethod === 'upi') {
            mode = 'UPI';
        }

        const payoutData = {
            account_number: process.env.RAZORPAY_ACCOUNT_NUMBER, // RazorpayX account number (required)
            fund_account_id: fundAccountId,
            amount: Math.round(amount * 100), // Convert to paise
            currency: 'INR',
            mode: mode,
            purpose: 'payout',
            queue_if_low_balance: true,
            reference_id: `payout_${id}_${Date.now()}`,
            narration: `Payout - ${payoutRequest.accountName}`,
            notes: {
                payout_request_id: id.toString()
            }
        };

        console.log('📤 Attempting to create payout with data:', {
            fund_account_id: fundAccountId,
            amount: payoutData.amount,
            mode: mode
        });

        const response = await razorpayAPI.post('/payouts', payoutData, {
            headers: {
                'X-Payout-Idempotency': `payout_${id}` // Idempotency key to prevent double payouts
            }
        });
        const payout = response.data;

        console.log(`✅ Created payout: ${payout.id} for ₹${amount} via ${mode}`);
        console.log(`   Status: ${payout.status}`);
        console.log(`   UTR: ${payout.utr || 'Pending'}`);

        return {
            id: payout.id,
            status: payout.status,
            utr: payout.utr
        };
    } catch (err) {
        console.error('Create payout error - Full details:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
        });

        // Handle specific errors
        if (err.response?.data?.error?.description) {
            throw new Error(err.response.data.error.description);
        }

        throw new Error(`Failed to create payout: ${err.message}`);
    }
}

/**
 * Get payout status
 */
export async function getPayoutStatus(razorpayPayoutId) {
    try {
        const response = await razorpayAPI.get(`/payouts/${razorpayPayoutId}`);
        const payout = response.data;

        return {
            status: payout.status, // queued, pending, processing, processed, reversed, cancelled
            utr: payout.utr,
            failure_reason: payout.failure_reason
        };
    } catch (err) {
        console.error('Get payout status error:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
        });
        throw new Error(`Failed to get payout status: ${err.message}`);
    }
}

/**
 * Main function to process payout automatically
 */
export async function processPayoutAutomatically(payoutRequestId) {
    try {
        console.log(`\n🚀 Starting automated payout for request #${payoutRequestId}`);

        // Get payout request with user details
        const payoutRequest = await prisma.payoutRequest.findUnique({
            where: { id: payoutRequestId },
            include: { user: true }
        });

        if (!payoutRequest) {
            throw new Error('Payout request not found');
        }

        if (payoutRequest.status !== 'pending') {
            throw new Error(`Payout is already ${payoutRequest.status}`);
        }

        // Step 1: Create or get contact
        console.log('📞 Step 1: Creating/getting Razorpay contact...');
        const contactId = await getOrCreateContact(payoutRequest.user);

        // Step 2: Create fund account
        console.log('🏦 Step 2: Creating fund account...');
        const fundAccountId = await createFundAccount(payoutRequest, contactId);

        // Step 3: Create payout
        console.log('💸 Step 3: Initiating payout transfer...');
        const payout = await createPayout(payoutRequest, fundAccountId);

        // Step 4: Update payout request
        console.log('💾 Step 4: Updating payout request...');
        const updatedRequest = await prisma.payoutRequest.update({
            where: { id: payoutRequestId },
            data: {
                razorpayContactId: contactId,
                razorpayFundAccountId: fundAccountId,
                razorpayPayoutId: payout.id,
                status: 'processing',
                processedAt: new Date(),
                adminNote: `Automated payout initiated via Razorpay. Status: ${payout.status}${payout.utr ? `, UTR: ${payout.utr}` : ''}`
            }
        });

        console.log(`✅ Payout automated successfully!`);
        console.log(`   Razorpay Payout ID: ${payout.id}`);
        console.log(`   Status: ${payout.status}`);
        console.log(`   Mode: ${payoutRequest.paymentMethod === 'upi' ? 'UPI' : 'IMPS'}`);

        return updatedRequest;
    } catch (err) {
        console.error('❌ Automated payout failed:', {
            status: err.response?.status,
            statusText: err.response?.statusText,
            data: err.response?.data,
            message: err.message
        });

        // Update status to failed and add error note
        await prisma.payoutRequest.update({
            where: { id: payoutRequestId },
            data: {
                status: 'failed',
                adminNote: `Automated payout failed: ${err.message}`
            }
        });

        throw err;
    }
}
