import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';
import Merchant from '../../models/Merchant.js';

const router = express.Router();

// Gets all merchant enquiries with pagination (legacy route)
router.get('/enquiries', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Merchant.countDocuments();
        const merchants = await Merchant.find({}, 'businessName contactPerson email phone businessType region alternatePhone message createdAt')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            merchants,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            }
        });
    } catch (err) {
        console.error('Get merchant enquiries error:', err);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// Deletes a merchant enquiry by ID (legacy route)
router.delete('/enquiries/:id', protect, async (req, res) => {
    try {
        const deletedMerchant = await Merchant.findByIdAndDelete(req.params.id);
        if (!deletedMerchant) {
            return res.status(404).json({ success: false, message: 'Merchant enquiry not found' });
        }
        res.status(200).json({ success: true, message: 'Merchant enquiry deleted successfully' });
    } catch (err) {
        console.error('Error deleting merchant enquiry:', err);
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

// Get all merchants with pagination
router.get('/', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 20;
        const skip = (page - 1) * limit;

        const total = await Merchant.countDocuments();
        const merchants = await Merchant.find()
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit)
            .lean();

        res.status(200).json({
            success: true,
            merchants,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            }
        });
    } catch (err) {
        console.error('Get merchants error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Get merchant by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const merchant = await Merchant.findById(req.params.id);

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: 'Merchant not found'
            });
        }

        res.status(200).json({
            success: true,
            merchant
        });
    } catch (err) {
        console.error('Get merchant error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Update merchant status
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { status } = req.body;

        const merchant = await Merchant.findByIdAndUpdate(
            req.params.id,
            { status },
            { new: true }
        );

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: 'Merchant not found'
            });
        }

        res.status(200).json({
            success: true,
            message: `Merchant status updated to ${status}`,
            merchant
        });
    } catch (err) {
        console.error('Update merchant status error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Approve merchant
router.put('/:id/approve', protect, async (req, res) => {
    try {
        const merchant = await Merchant.findByIdAndUpdate(
            req.params.id,
            {
                approvalStatus: 'approved',
                status: 'active'
            },
            { new: true }
        );

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: 'Merchant not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Merchant approved successfully',
            merchant
        });
    } catch (err) {
        console.error('Approve merchant error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Reject merchant
router.put('/:id/reject', protect, async (req, res) => {
    try {
        const merchant = await Merchant.findByIdAndUpdate(
            req.params.id,
            {
                approvalStatus: 'rejected',
                status: 'inactive'
            },
            { new: true }
        );

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: 'Merchant not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Merchant rejected',
            merchant
        });
    } catch (err) {
        console.error('Reject merchant error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

// Delete merchant
router.delete('/:id', protect, async (req, res) => {
    try {
        const merchant = await Merchant.findByIdAndDelete(req.params.id);

        if (!merchant) {
            return res.status(404).json({
                success: false,
                message: 'Merchant not found'
            });
        }

        res.status(200).json({
            success: true,
            message: 'Merchant deleted successfully'
        });
    } catch (err) {
        console.error('Delete merchant error:', err);
        res.status(500).json({
            success: false,
            message: 'Server error. Please try again later.'
        });
    }
});

export default router;