import express from 'express';
import Order from '../../models/Order.js';
import { protectWithRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Get all orders with filters
router.get('/', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;
        
        const { status, paymentStatus, deliveryType, search, startDate, endDate } = req.query;
        
        let query = {};
        
        if (status) {
            query['status.current'] = status;
        }
        
        if (paymentStatus) {
            query['payment.status'] = paymentStatus;
        }
        
        if (deliveryType) {
            query['delivery.type'] = deliveryType;
        }
        
        if (search) {
            query.$or = [
                { orderNumber: { $regex: search, $options: 'i' } },
                { 'customer.name': { $regex: search, $options: 'i' } },
                { 'customer.phone': { $regex: search, $options: 'i' } }
            ];
        }
        
        if (startDate && endDate) {
            query.createdAt = {
                $gte: new Date(startDate),
                $lte: new Date(endDate)
            };
        }

        const orders = await Order.find(query)
            .populate('customer.userId', 'personalInfo.name personalInfo.email personalInfo.phone')
            .populate('delivery.agentId', 'personalInfo.firstName personalInfo.lastName personalInfo.phone')
            .populate('items.productId', 'name image price')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Order.countDocuments(query);

        res.json({
            success: true,
            orders,
            pagination: {
                total,
                page,
                limit,
                totalPages: Math.ceil(total / limit),
                hasNextPage: page * limit < total,
                hasPrevPage: page > 1
            }
        });
    } catch (error) {
        console.error('Get orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get order by ID
router.get('/:id', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const order = await Order.findById(req.params.id)
            .populate('customer.userId', 'personalInfo.name personalInfo.email personalInfo.phone')
            .populate('delivery.agentId', 'personalInfo.firstName personalInfo.lastName personalInfo.phone status.currentLocation')
            .populate('items.productId', 'name image price category')
            .populate('support.issues.assignedTo', 'name email');

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({
            success: true,
            order
        });
    } catch (error) {
        console.error('Get order error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update order status
router.put('/:id/status', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { status, notes } = req.body;
        const orderId = req.params.id;
        
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        // Update order status using the model method
        await order.updateStatus(status, 'admin', notes);

        res.json({
            success: true,
            message: 'Order status updated successfully',
            order
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Assign delivery agent to order
router.put('/:id/assign-agent', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { agentId } = req.body;
        const orderId = req.params.id;
        
        // Get agent details
        const agent = await DeliveryAgent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                'delivery.agentId': agentId,
                'delivery.agentName': `${agent.personalInfo.firstName} ${agent.personalInfo.lastName}`,
                'delivery.agentPhone': agent.personalInfo.phone,
                'status.current': 'picked_up'
            },
            { new: true }
        );

        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        res.json({ success: true, order });
    } catch (error) {
        console.error('Error assigning agent to order:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

// Assign delivery agent to order (alternative endpoint)
router.post('/:id/assign', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { agentId } = req.body;
        const orderId = req.params.id;
        
        // Get agent details
        const agent = await DeliveryAgent.findById(agentId);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                'assignment.deliveryAgent': agentId,
                'assignment.assignedAt': new Date(),
                'status.current': 'confirmed'
            },
            { new: true }
        );

        // Update agent's delivery count
        agent.status.totalDeliveries += 1;
        await agent.save();

        // Add to order history
        await order.updateStatus('picked_up', 'admin', `Assigned to ${agent.personalInfo.firstName} ${agent.personalInfo.lastName}`);

        res.json({
            success: true,
            message: 'Delivery agent assigned successfully',
            order
        });
    } catch (error) {
        console.error('Assign agent error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Cancel order
router.put('/:id/cancel', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { reason, refundAmount } = req.body;
        const orderId = req.params.id;
        
        const order = await Order.findByIdAndUpdate(
            orderId,
            {
                'status.current': 'cancelled',
                'cancellation.reason': reason,
                'cancellation.cancelledBy': 'admin',
                'cancellation.cancelledAt': new Date(),
                'cancellation.refundAmount': refundAmount || 0,
                'cancellation.refundStatus': refundAmount > 0 ? 'pending' : 'not_applicable'
            },
            { new: true }
        );

        await order.updateStatus('cancelled', 'admin', `Cancelled by admin: ${reason}`);

        res.json({
            success: true,
            message: 'Order cancelled successfully',
            order
        });
    } catch (error) {
        console.error('Cancel order error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get order statistics
router.get('/stats/overview', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);

        const [
            totalOrders,
            todayOrders,
            pendingOrders,
            activeOrders,
            completedOrders,
            cancelledOrders,
            totalRevenue,
            todayRevenue
        ] = await Promise.all([
            Order.countDocuments(),
            Order.countDocuments({ createdAt: { $gte: today } }),
            Order.countDocuments({ 'status.current': { $in: ['placed', 'confirmed'] } }),
            Order.countDocuments({ 'status.current': { $in: ['preparing', 'ready_for_pickup', 'picked_up', 'out_for_delivery'] } }),
            Order.countDocuments({ 'status.current': 'delivered' }),
            Order.countDocuments({ 'status.current': 'cancelled' }),
            Order.aggregate([
                { $match: { 'status.current': 'delivered' } },
                { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
            ]),
            Order.aggregate([
                { 
                    $match: { 
                        'status.current': 'delivered',
                        createdAt: { $gte: today }
                    } 
                },
                { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
            ])
        ]);

        res.json({
            success: true,
            stats: {
                totalOrders,
                todayOrders,
                pendingOrders,
                activeOrders,
                completedOrders,
                cancelledOrders,
                totalRevenue: totalRevenue[0]?.total || 0,
                todayRevenue: todayRevenue[0]?.total || 0
            }
        });
    } catch (error) {
        console.error('Get order stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get orders analytics
router.get('/analytics/chart-data', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const { period = '7d' } = req.query;
        
        let startDate = new Date();
        switch (period) {
            case '7d':
                startDate.setDate(startDate.getDate() - 7);
                break;
            case '30d':
                startDate.setDate(startDate.getDate() - 30);
                break;
            case '90d':
                startDate.setDate(startDate.getDate() - 90);
                break;
            default:
                startDate.setDate(startDate.getDate() - 7);
        }

        const analyticsData = await Order.aggregate([
            {
                $match: {
                    createdAt: { $gte: startDate }
                }
            },
            {
                $group: {
                    _id: {
                        year: { $year: '$createdAt' },
                        month: { $month: '$createdAt' },
                        day: { $dayOfMonth: '$createdAt' }
                    },
                    orderCount: { $sum: 1 },
                    revenue: {
                        $sum: {
                            $cond: [
                                { $eq: ['$status.current', 'delivered'] },
                                '$pricing.totalAmount',
                                0
                            ]
                        }
                    },
                    avgOrderValue: { $avg: '$pricing.totalAmount' }
                }
            },
            {
                $sort: { '_id.year': 1, '_id.month': 1, '_id.day': 1 }
            }
        ]);

        res.json({
            success: true,
            analyticsData
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Dummy endpoint for analytics chart data (for frontend testing)
// router.get('/analytics/chart-data', (req, res) => {
//     const { period = '7d' } = req.query;
//     const today = new Date();
//     const days = period === '30d' ? 30 : period === '90d' ? 90 : 7;
//     const analyticsData = [];

//     for (let i = days - 1; i >= 0; i--) {
//         const date = new Date(today);
//         date.setDate(today.getDate() - i);
//         analyticsData.push({
//             _id: {
//                 year: date.getFullYear(),
//                 month: date.getMonth() + 1,
//                 day: date.getDate()
//             },
//             orderCount: Math.floor(Math.random() * 10) + 1,
//             revenue: Math.floor(Math.random() * 1000) + 100,
//             avgOrderValue: Math.floor(Math.random() * 100) + 20
//         });
//     }

//     res.json({
//         success: true,
//         analyticsData
//     });
// });

export default router;
