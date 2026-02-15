import express from 'express';
import { PrismaClient } from '@prisma/client';
import { auth, adminOnly } from '../middleware/auth.js';
import cloudinary from '../config/cloudinary.js';
import multer from 'multer';

const prisma = new PrismaClient();
const router = express.Router();
const upload = multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only images are allowed for avatars.'), false);
        }
    }
});

// GET /api/users - List all users (admin only)
router.get('/', auth, adminOnly, async (req, res) => {
    try {
        const users = await prisma.user.findMany({
            select: { id: true, username: true, email: true, displayName: true, avatarUrl: true, role: true, status: true, createdAt: true },
            orderBy: { createdAt: 'desc' },
        });
        res.json(users);
    } catch (err) {
        console.error('List users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/search - Search for users to message
router.get('/search', auth, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim().length < 2) {
            return res.json([]);
        }

        const users = await prisma.user.findMany({
            where: {
                AND: [
                    { id: { not: req.user.id } },
                    { status: 'active' },
                    {
                        OR: [
                            { username: { contains: q, mode: 'insensitive' } },
                            { displayName: { contains: q, mode: 'insensitive' } }
                        ]
                    }
                ]
            },
            select: { id: true, username: true, displayName: true, avatarUrl: true },
            take: 10
        });

        res.json(users);
    } catch (err) {
        console.error('Search users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/:id - Get user profile
router.get('/:id', auth, async (req, res) => {
    try {
        const user = await prisma.user.findUnique({
            where: { id: parseInt(req.params.id) },
            select: { id: true, username: true, email: true, displayName: true, bio: true, avatarUrl: true, role: true, status: true, createdAt: true },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(user);
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/profile/:id - Get detailed user profile
router.get('/profile/:id', auth, async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: parseInt(req.params.id) },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                role: true,
                status: true,
                telegramId: true,
                createdAt: true
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        res.json(user);
    } catch (err) {
        console.error('Get profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// PUT /api/users/profile/:id - Update user profile
router.put('/profile/:id', auth, async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const { displayName, bio, email, avatarUrl, role } = req.body;

        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (bio !== undefined) updateData.bio = bio;
        if (email !== undefined) updateData.email = email;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (role !== undefined && ['client', 'vendor'].includes(role)) updateData.role = role;

        const updatedUser = await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: updateData,
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                role: true,
                status: true,
                telegramId: true,
                createdAt: true
            }
        });

        res.json(updatedUser);
    } catch (err) {
        console.error('Update profile error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// POST /api/users/avatar - Upload avatar
router.post('/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                {
                    folder: 'vesper/avatars',
                    transformation: [{ width: 400, height: 400, crop: 'fill', gravity: 'face' }],
                    access_mode: 'public'
                },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        // Update user's avatar URL
        await prisma.user.update({
            where: { id: req.user.id },
            data: { avatarUrl: result.secure_url },
        });

        res.json({ avatarUrl: result.secure_url });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

// PUT /api/users/:id/avatar - Upload avatar to Cloudinary (legacy endpoint)
router.put('/:id/avatar', auth, upload.single('avatar'), async (req, res) => {
    try {
        if (req.user.id !== parseInt(req.params.id) && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded.' });
        }

        const result = await new Promise((resolve, reject) => {
            const stream = cloudinary.uploader.upload_stream(
                { folder: 'vesper/avatars', transformation: [{ width: 200, height: 200, crop: 'fill' }] },
                (error, result) => {
                    if (error) reject(error);
                    else resolve(result);
                }
            );
            stream.end(req.file.buffer);
        });

        await prisma.user.update({
            where: { id: parseInt(req.params.id) },
            data: { avatarUrl: result.secure_url },
        });

        res.json({ avatar_url: result.secure_url });
    } catch (err) {
        console.error('Avatar upload error:', err);
        res.status(500).json({ error: 'Upload failed.' });
    }
});

export default router;
