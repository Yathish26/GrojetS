import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';
import User from '../../models/User.js';

const router = express.Router();

router.get('/', protect, async (req, res) => {
    try {
        const limit = 10;
        const page = Math.max(1, parseInt(req.query.page)) || 1;
        const skip = (page - 1) * limit;

        const users = await User.find({}, { personalInfo: 1, status: 1, createdAt: 1 })
            .populate('personalInfo')
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

// Search users by name or email (case-insensitive, partial matches)
router.get('/search', protect, async (req, res) => {
    try {
        const { q } = req.query;
        if (!q || q.trim() === "") {
            return res.status(400).json({ message: 'Search query is required' });
        }

        // Case-insensitive, partial match on name or email
        const regex = new RegExp(q, 'i');
        const users = await User.find({
            $or: [
                { 'personalInfo.name': regex },
                { 'personalInfo.email': regex }
            ]
        }, { name: 1, email: 1, status: 1, createdAt: 1 });

        res.status(200).json({
            success: true,
            users
        });
    } catch (err) {
        console.error('Search users error:', err);
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

// Get user by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }
        res.status(200).json({ success: true, user });
    } catch (err) {
        console.error('Get user error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Warn user (add warning to user's warnings array)
router.patch('/:id/warn', protect, async (req, res) => {
    try {
        const { warning } = req.body;

        if (!warning) {
            return res.status(400).json({ message: 'Warning message is required' });
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            {
                $push: {
                    warnings: {
                        reason: warning,
                        addedBy: req.user.id, // Admin ID from middleware
                        addedAt: new Date()
                    }
                }
            },
            { new: true }
        );

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: 'Warning issued to user',
            user: {
                id: user._id,
                name: user.personalInfo.name,
                email: user.personalInfo.email,
                warningAdded: true
            }
        });
    } catch (err) {
        console.error('Warn user error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Get user's warning history
router.get('/:id/warnings', protect, async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('warnings.addedBy', 'name email')
            .select('personalInfo.name personalInfo.email warnings');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            user: {
                id: user._id,
                name: user.personalInfo.name,
                email: user.personalInfo.email
            },
            warnings: user.warnings.map(warning => ({
                id: warning._id,
                message: warning.reason,
                addedBy: warning.addedBy,
                addedAt: warning.addedAt
            }))
        });
    } catch (err) {
        console.error('Get warnings error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user status (suspend/activate)
router.patch('/:id/status', protect, async (req, res) => {
    try {
        const { status, reason } = req.body;

        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        let updateData = { status };

        if (status === 'suspended' || status === 'banned') {
            if (!reason) {
                return res.status(400).json({ message: 'Reason is required for suspension/ban' });
            }
            updateData = {
                ...updateData,
                'restrictions.restrictions': [
                    {
                        type: status,
                        reason,
                        appliedAt: new Date(),
                        appliedBy: req.user._id
                    }
                ]
            };
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-authentication.password');

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        res.status(200).json({
            success: true,
            message: `User ${status} successfully`,
            user: {
                id: user._id,
                name: user.personalInfo.name,
                email: user.personalInfo.email,
                status: user.status
            }
        });
    } catch (err) {
        console.error('Update user status error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Update user status (PUT method for React Native compatibility)
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { status, reason } = req.body;

        if (!['active', 'suspended', 'banned'].includes(status)) {
            return res.status(400).json({ message: 'Invalid status' });
        }

        let updateData = { status };

        if (status === 'suspended' || status === 'banned') {
            if (!reason) {
                return res.status(400).json({ message: 'Reason is required for suspension/ban' });
            }
            updateData = {
                ...updateData,
                'restrictions.restrictions': [
                    {
                        type: status,
                        reason,
                        appliedAt: new Date(),
                        appliedBy: req.user._id
                    }
                ]
            };
        }

        const user = await User.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-authentication.password');

        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: `User ${status} successfully`,
            user: {
                id: user._id,
                name: user.personalInfo.name,
                email: user.personalInfo.email,
                status: user.status
            }
        });
    } catch (err) {
        console.error('Update user status error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
});

// DELETE user by ID
router.delete('/:id', protect, async (req, res) => {
    try {
        const user = await User.findByIdAndDelete(req.params.id);
        
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: 'User deleted successfully'
        });
    } catch (err) {
        console.error('Delete user error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
});

export default router;