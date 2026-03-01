import express from 'express';
import { createServer } from 'http';
import { Server } from 'socket.io';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

import authRoutes from './routes/auth.js';
import userRoutes from './routes/users.js';
import messageRoutes from './routes/messages.js';
import adminRoutes from './routes/admin.js';
import escrowRoutes from './routes/escrow.js';
import moderationRoutes from './routes/moderation.js';
import verificationRoutes from './routes/verification.js';
import paymentRoutes from './routes/payments.js';
import walletRoutes from './routes/wallet.js';
import webhookRoutes from './routes/webhooks.js';
import notificationRoutes from './routes/notifications.js';
import setupSocket from './socket/chat.js';

dotenv.config();

const app = express();
const server = createServer(app);
const allowedOrigins = [
    'http://localhost:5173',
    'http://localhost:8080',
    'http://127.0.0.1:5173',
    'http://127.0.0.1:8080',
    'https://krovaa.com',
    'https://www.krovaa.com',
    'http://krovaa.com',
    process.env.FRONTEND_URL,
    process.env.FRONTEND_URL?.toLowerCase()
].filter(Boolean);

// Middleware
app.use(cors({
    origin: (origin, callback) => {
        // Allow requests with no origin (like mobile apps/curl)
        if (!origin) return callback(null, true);

        if (allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`🚫 CORS blocked for origin: ${origin}`);
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200
}));

app.use(express.json({
    verify: (req, res, buf) => {
        req.rawBody = buf;
    }
}));
app.use(express.urlencoded({ extended: true }));

// Webhooks (no auth needed)
app.use('/webhooks', webhookRoutes);

// Socket.IO setup with shared server
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        credentials: true
    },
});

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/escrow', escrowRoutes);
app.use('/api/moderation', moderationRoutes);
app.use('/api/verification', verificationRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Socket.IO
setupSocket(io);
app.set('io', io);

// Start server
const PORT = process.env.PORT || 5000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`
  ╔══════════════════════════════════════╗
  ║   🚀 Krovaa API Server Running      ║
  ║   Port: ${PORT}                      ║
  ╚══════════════════════════════════════╝
  `);
});
