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
            select: { id: true, username: true, email: true, displayName: true, avatarUrl: true, role: true, status: true, verified: true, createdAt: true },
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
            select: { id: true, username: true, displayName: true, avatarUrl: true, verified: true },
            take: 10
        });

        res.json(users);
    } catch (err) {
        console.error('Search users error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/username/:username - Get user profile by username
router.get('/username/:username', auth, async (req, res) => {
    try {
        const { username } = req.params;
        const user = await prisma.user.findUnique({
            where: { username: username },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                socialLinks: true,
                role: true,
                status: true,
                verified: true,
                createdAt: true,
                ratingsReceived: {
                    select: { rating: true }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
        });
    } catch (err) {
        console.error('Get user by username error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/:id - Get user profile with rating
router.get('/:id', auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                socialLinks: true,
                role: true,
                status: true,
                verified: true,
                createdAt: true,
                ratingsReceived: {
                    select: { rating: true }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
        });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

// GET /api/users/profile/:id - Get detailed user profile with rating
router.get('/profile/:id', auth, async (req, res) => {
    try {
        const userId = parseInt(req.params.id);
        if (req.user.id !== userId && req.user.role !== 'admin') {
            return res.status(403).json({ error: 'Not authorized.' });
        }

        const user = await prisma.user.findUnique({
            where: { id: userId },
            select: {
                id: true,
                username: true,
                email: true,
                displayName: true,
                bio: true,
                avatarUrl: true,
                role: true,
                status: true,
                verified: true,
                telegramId: true,
                socialLinks: true,
                createdAt: true,
                ratingsReceived: {
                    select: { rating: true }
                }
            },
        });

        if (!user) {
            return res.status(404).json({ error: 'User not found.' });
        }

        const ratings = user.ratingsReceived.map(r => r.rating);
        const avgRating = ratings.length > 0 ? (ratings.reduce((a, b) => a + b, 0) / ratings.length).toFixed(1) : "0.0";

        res.json({
            ...user,
            averageRating: parseFloat(avgRating),
            ratingCount: ratings.length,
            ratingsReceived: undefined
        });
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

        const { displayName, bio, email, avatarUrl, role, socialLinks } = req.body;

        const updateData = {};
        if (displayName !== undefined) updateData.displayName = displayName;
        if (bio !== undefined) updateData.bio = bio;
        if (email !== undefined) updateData.email = email;
        if (avatarUrl !== undefined) updateData.avatarUrl = avatarUrl;
        if (socialLinks !== undefined) updateData.socialLinks = socialLinks;
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
                verified: true,
                telegramId: true,
                socialLinks: true,
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

// POST /api/users/rate - Rate a user
router.post('/rate', auth, async (req, res) => {
    try {
        const { reviewedId, rating, comment } = req.body;

        if (!reviewedId || !rating) {
            return res.status(400).json({ error: "Missing required fields." });
        }

        if (req.user.id === parseInt(reviewedId)) {
            return res.status(400).json({ error: "You cannot rate yourself." });
        }

        const ratingVal = parseInt(rating);
        if (ratingVal < 1 || ratingVal > 5) {
            return res.status(400).json({ error: "Rating must be between 1 and 5." });
        }

        const ratingObj = await prisma.rating.upsert({
            where: {
                reviewerId_reviewedId: {
                    reviewerId: req.user.id,
                    reviewedId: parseInt(reviewedId)
                }
            },
            update: { rating: ratingVal, comment: comment || null },
            create: {
                reviewerId: req.user.id,
                reviewedId: parseInt(reviewedId),
                rating: ratingVal,
                comment: comment || null
            }
        });

        await prisma.activityLog.create({ data: { userId: req.user.id, action: 'Rated user', details: `User ID: ${reviewedId}, Rating: ${ratingVal}` } });

        res.json(ratingObj);
    } catch (err) {
        console.error('Rate user error:', err);
        res.status(500).json({ error: 'Server error.' });
    }
});

export default router;
