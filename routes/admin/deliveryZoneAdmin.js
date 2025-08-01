import express from 'express';
import DeliveryZone from '../../models/DeliveryZone.js';
import { protectWithRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Get all delivery zones
router.get('/', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const zones = await DeliveryZone.find({})
            .sort({ name: 1 });

        res.json({
            success: true,
            zones
        });
    } catch (error) {
        console.error('Get delivery zones error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new delivery zone
router.post('/', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const newZone = new DeliveryZone(req.body);
        await newZone.save();

        res.status(201).json({
            success: true,
            message: 'Delivery zone created successfully',
            zone: newZone
        });
    } catch (error) {
        console.error('Create delivery zone error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update delivery zone
router.put('/:id', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const zone = await DeliveryZone.findByIdAndUpdate(
            req.params.id,
            req.body,
            { new: true, runValidators: true }
        );

        if (!zone) {
            return res.status(404).json({ success: false, message: 'Delivery zone not found' });
        }

        res.json({
            success: true,
            message: 'Delivery zone updated successfully',
            zone
        });
    } catch (error) {
        console.error('Update delivery zone error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete delivery zone
router.delete('/:id', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const zone = await DeliveryZone.findByIdAndDelete(req.params.id);

        if (!zone) {
            return res.status(404).json({ success: false, message: 'Delivery zone not found' });
        }

        res.json({
            success: true,
            message: 'Delivery zone deleted successfully'
        });
    } catch (error) {
        console.error('Delete delivery zone error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
