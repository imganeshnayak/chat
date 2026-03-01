import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { PrismaClient } from '@prisma/client';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.join(__dirname, '..', '.env') });

const prisma = new PrismaClient();

const auth = async (req, res, next) => {
    const authHeader = req.header('Authorization');
    const token = authHeader?.replace('Bearer ', '');

    if (!token) {
        // Temporary Bypass for Development only if no token provided
        if (process.env.NODE_ENV !== 'production') {
            console.log('No token provided, using dev bypass (User ID: 1)');
            req.user = { id: 1, username: 'admin', role: 'admin' };
            return next();
        }
        return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // CHECK USER STATUS IN DATABASE
        const user = await prisma.user.findUnique({
            where: { id: decoded.id },
            select: { status: true }
        });

        if (!user) {
            return res.status(401).json({ error: 'User not found.' });
        }

        if (user.status !== 'active') {
            return res.status(403).json({
                error: `Account ${user.status}.`,
                status: user.status
            });
        }

        req.user = decoded;
        next();
    } catch (err) {
        console.error('JWT Verification Error:', err.message);
        // Fallback for dev if token is invalid
        if (process.env.NODE_ENV !== 'production') {
            console.log('Invalid token, falling back to dev bypass (User ID: 1)');
            req.user = { id: 1, username: 'admin', role: 'admin' };
            return next();
        }
        res.status(401).json({ error: 'Invalid token.' });
    }
};

// Admin-only middleware
const adminOnly = (req, res, next) => {
    if (req.user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required.' });
    }
    next();
};

export { auth, adminOnly };
