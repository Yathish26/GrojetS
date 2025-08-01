import express from 'express';
import Inventory from '../models/Inventory.js';
import { protectNative } from '../middleware/authMiddleware.js';

const router = express.Router();

// Get all inventory items
router.get('/all', protectNative, async (req, res) => {
    try {
        const { page = 1, limit = 20, search, category, status } = req.query;
        
        // Build filter object
        const filter = {};
        
        if (search) {
            filter.$or = [
                { name: { $regex: search, $options: 'i' } },
                { description: { $regex: search, $options: 'i' } },
                { category: { $regex: search, $options: 'i' } }
            ];
        }
        
        if (category) {
            filter.category = category;
        }
        
        if (status) {
            filter.status = status;
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [items, total] = await Promise.all([
            Inventory.find(filter)
                .populate('createdBy', 'name email')
                .sort({ lastUpdated: -1 })
                .skip(skip)
                .limit(parseInt(limit)),
            Inventory.countDocuments(filter)
        ]);

        res.json({
            success: true,
            data: {
                items,
                pagination: {
                    currentPage: parseInt(page),
                    totalPages: Math.ceil(total / parseInt(limit)),
                    totalItems: total,
                    itemsPerPage: parseInt(limit)
                }
            }
        });
    } catch (error) {
        console.error('Get inventory error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory items'
        });
    }
});

// Add new inventory item
router.post('/add', protectNative, async (req, res) => {
    try {
        const inventoryData = {
            ...req.body,
            createdBy: req.user.agentId
        };

        const newItem = new Inventory(inventoryData);
        await newItem.save();

        await newItem.populate('createdBy', 'name email');

        res.status(201).json({
            success: true,
            message: 'Inventory item added successfully',
            data: newItem
        });
    } catch (error) {
        console.error('Add inventory error:', error);
        
        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to add inventory item'
        });
    }
});

// Update inventory item
router.put('/edit/:id', protectNative, async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        const updatedItem = await Inventory.findByIdAndUpdate(
            id,
            { ...updateData, lastUpdated: new Date() },
            { new: true, runValidators: true }
        ).populate('createdBy', 'name email');

        if (!updatedItem) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        res.json({
            success: true,
            message: 'Inventory item updated successfully',
            data: updatedItem
        });
    } catch (error) {
        console.error('Update inventory error:', error);

        if (error.name === 'ValidationError') {
            const validationErrors = Object.values(error.errors).map(err => err.message);
            return res.status(400).json({
                success: false,
                message: 'Validation failed',
                errors: validationErrors
            });
        }

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid inventory item ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to update inventory item'
        });
    }
});

// Delete inventory item
router.delete('/delete/:id', protectNative, async (req, res) => {
    try {
        const { id } = req.params;

        const deletedItem = await Inventory.findByIdAndDelete(id);

        if (!deletedItem) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        res.json({
            success: true,
            message: 'Inventory item deleted successfully',
            data: deletedItem
        });
    } catch (error) {
        console.error('Delete inventory error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid inventory item ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to delete inventory item'
        });
    }
});

// Get inventory by ID
router.get('/:id', protectNative, async (req, res) => {
    try {
        const { id } = req.params;

        const item = await Inventory.findById(id)
            .populate('createdBy', 'name email');

        if (!item) {
            return res.status(404).json({
                success: false,
                message: 'Inventory item not found'
            });
        }

        res.json({
            success: true,
            data: item
        });
    } catch (error) {
        console.error('Get inventory item error:', error);

        if (error.name === 'CastError') {
            return res.status(400).json({
                success: false,
                message: 'Invalid inventory item ID'
            });
        }

        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory item'
        });
    }
});

// Get low stock items
router.get('/alerts/low-stock', protectNative, async (req, res) => {
    try {
        const lowStockItems = await Inventory.aggregate([
            {
                $match: {
                    $expr: { $lte: ['$quantity', '$minStockLevel'] },
                    status: 'active'
                }
            },
            {
                $lookup: {
                    from: 'admins',
                    localField: 'createdBy',
                    foreignField: '_id',
                    as: 'createdBy'
                }
            },
            {
                $unwind: '$createdBy'
            },
            {
                $project: {
                    name: 1,
                    category: 1,
                    quantity: 1,
                    minStockLevel: 1,
                    unit: 1,
                    location: 1,
                    'createdBy.name': 1,
                    'createdBy.email': 1
                }
            },
            {
                $sort: { quantity: 1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                items: lowStockItems,
                count: lowStockItems.length
            }
        });
    } catch (error) {
        console.error('Get low stock items error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch low stock items'
        });
    }
});

// Get inventory statistics
router.get('/stats/summary', protectNative, async (req, res) => {
    try {
        const stats = await Inventory.aggregate([
            {
                $group: {
                    _id: null,
                    totalItems: { $sum: 1 },
                    totalValue: { $sum: { $multiply: ['$quantity', '$price'] } },
                    totalQuantity: { $sum: '$quantity' },
                    activeItems: {
                        $sum: { $cond: [{ $eq: ['$status', 'active'] }, 1, 0] }
                    },
                    lowStockItems: {
                        $sum: { $cond: [{ $lte: ['$quantity', '$minStockLevel'] }, 1, 0] }
                    }
                }
            }
        ]);

        const categoryStats = await Inventory.aggregate([
            {
                $match: { status: 'active' }
            },
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    totalQuantity: { $sum: '$quantity' },
                    totalValue: { $sum: { $multiply: ['$quantity', '$price'] } }
                }
            },
            {
                $sort: { count: -1 }
            }
        ]);

        res.json({
            success: true,
            data: {
                summary: stats[0] || {
                    totalItems: 0,
                    totalValue: 0,
                    totalQuantity: 0,
                    activeItems: 0,
                    lowStockItems: 0
                },
                categoryBreakdown: categoryStats
            }
        });
    } catch (error) {
        console.error('Get inventory stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to fetch inventory statistics'
        });
    }
});

export default router;
