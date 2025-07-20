import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';
import User from '../../models/User.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
    try {
        const limit = 10;
        const page = Math.max(1, parseInt(req.query.page)) || 1;
        const skip = (page - 1) * limit;

        const users = await User.find({}, { name: 1, email: 1, status: 1, createdAt: 1 })
            .sort({ name: 1 })
            .skip(skip)
            .limit(limit);

        const totalUsers = await User.countDocuments();

        res.status(200).json({
            success: true,
            users,
            pagination: {
                total: totalUsers,
                page,
                totalPages: Math.ceil(totalUsers / limit),
                hasNextPage: skip + limit < totalUsers,
                hasPrevPage: page > 1,
            },
        });
    } catch (err) {
        console.error('Get users error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});


// Gets the total count of all users
router.get('/count', protect, async (req, res) => {
    try {
        const count = await User.countDocuments();
        res.status(200).json({ success: true, count });
    } catch (err) {
        console.error('Get user count error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;