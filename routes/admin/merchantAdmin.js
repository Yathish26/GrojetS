import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';
import Merchant from '../../models/Merchant.js';

const router = express.Router();

// Gets all merchant enquiries with pagination
router.get('/enquiries', protect, async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const total = await Merchant.countDocuments();
        const merchants = await Merchant.find({}, 'businessName contactPerson email phone businessType address message createdAt')
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

// Deletes a merchant enquiry by ID
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


export default router;