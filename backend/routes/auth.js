import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { PrismaClient } from '@prisma/client';
import { auth } from '../middleware/auth.js';

const prisma = new PrismaClient();
const router = express.Router();

// POST /api/auth/register
router.post('/register', async (req, res) => {
    try {
        const { username, email, password, display_name } = req.body;

        const existing = await prisma.user.findFirst({
            where: { OR: [{ email }, { username }] },
        });
        if (existing) {
            return res.status(400).json({ error: 'User already exists.' });
        }

        const hashedPassword = await bcrypt.hash(password, 10);
        const user = await prisma.user.create({
            data: { username, email, password: hashedPassword, displayName: display_name || username },
            select: { id: true, username: true, email: true, displayName: true, role: true },
        });

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Registered' } });

        res.status(201).json({ user, token });
    } catch (err) {
        console.error('Register error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/auth/login
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await prisma.user.findUnique({ where: { email } });
        if (!user) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: `Account ${user.status}.`, status: user.status });
        }

        const validPassword = await bcrypt.compare(password, user.password);
        if (!validPassword) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Logged in' } });

        const { password: _, ...userWithoutPassword } = user;
        res.json({ user: userWithoutPassword, token });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/auth/me
router.get('/me', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: req.user.id },
            select: { id: true, username: true, email: true, displayName: true, avatarUrl: true, role: true, status: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(user);
    } catch (err) {
        console.error('Get me error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

import crypto from 'crypto';

// POST /api/auth/telegram
router.post('/telegram', async (req, res) => {
    try {
        const { auth_data } = req.body;
        const bot_token = process.env.TELEGRAM_BOT_TOKEN;

        if (!bot_token) {
            return res.status(500).json({ error: 'Telegram Bot Token not configured.' });
        }

        // 1. Verify integrity of data
        const { hash, ...data } = auth_data;
        const dataCheckString = Object.keys(data)
            .sort()
            .map(key => `${key}=${data[key]}`)
            .join('\n');

        const secretKey = crypto.createHash('sha256').update(bot_token).digest();
        const hmac = crypto.createHmac('sha256', secretKey).update(dataCheckString).digest('hex');

        if (hmac !== hash) {
            return res.status(401).json({ error: 'Data integrity check failed.' });
        }

        // 2. Check if data is expired (auth_date is in seconds)
        if (Date.now() / 1000 - data.auth_date > 86400) {
            return res.status(401).json({ error: 'Authentication data expired.' });
        }

        // 3. Find or create user
        let user = await prisma.user.findFirst({
            where: { telegramId: data.id.toString() }
        });

        if (!user) {
            // ... (upsert logic)
            user = await prisma.user.upsert({
                where: { username: data.username || `tg_${data.id}` },
                update: { telegramId: data.id.toString() },
                create: {
                    username: data.username || `tg_${data.id}`,
                    email: `${data.id}@telegram.user`, // Mock email
                    password: crypto.randomBytes(16).toString('hex'), // Random password
                    displayName: `${data.first_name} ${data.last_name || ''}`.trim(),
                    avatarUrl: data.photo_url,
                    telegramId: data.id.toString(),
                    role: 'client'
                }
            });
        }

        if (user.status !== 'active') {
            return res.status(403).json({ error: `Account ${user.status}.`, status: user.status });
        }

        const token = jwt.sign(
            { id: user.id, username: user.username, role: user.role },
            process.env.JWT_SECRET,
            { expiresIn: '7d' }
        );

        await prisma.activityLog.create({ data: { userId: user.id, action: 'Logged in via Telegram' } });

        res.json({ user, token });

    } catch (err) {
        console.error('Telegram Auth Error:', err);
        res.status(500).json({ error: 'Telegram authentication failed.' });
    }
});

export default router;
