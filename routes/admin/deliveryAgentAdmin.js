import express from 'express';
import jwt from 'jsonwebtoken';
import DeliveryAgent from '../../models/DeliveryAgent.js';
import { protectWithRole, checkPermission } from '../../middleware/authMiddleware.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

// Delivery agent signup
router.post('/signup', async (req, res) => {
    try {
        const {
            personalInfo,
            address,
            documents,
            vehicleInfo,
            workInfo,
            emergencyContact,
            password
        } = req.body;

        // Validate required fields
        if (!personalInfo || !personalInfo.firstName || !personalInfo.lastName || 
            !personalInfo.email || !personalInfo.phone || !personalInfo.dateOfBirth) {
            return res.status(400).json({
                success: false,
                message: 'Personal information is incomplete'
            });
        }

        if (!address || !address.street || !address.city || !address.state || !address.zipCode) {
            return res.status(400).json({
                success: false,
                message: 'Address information is incomplete'
            });
        }

        if (!vehicleInfo || !vehicleInfo.vehicleType || !vehicleInfo.vehicleNumber) {
            return res.status(400).json({
                success: false,
                message: 'Vehicle information is incomplete'
            });
        }

        if (!emergencyContact || !emergencyContact.name || !emergencyContact.phone) {
            return res.status(400).json({
                success: false,
                message: 'Emergency contact information is incomplete'
            });
        }

        if (!password || password.length < 6) {
            return res.status(400).json({
                success: false,
                message: 'Password must be at least 6 characters long'
            });
        }

        // Check if agent already exists
        const existingAgent = await DeliveryAgent.findOne({
            $or: [
                { 'personalInfo.email': personalInfo.email },
                { 'personalInfo.phone': personalInfo.phone }
            ]
        });

        if (existingAgent) {
            return res.status(400).json({
                success: false,
                message: 'Agent with this email or phone already exists'
            });
        }

        const newAgent = new DeliveryAgent({
            personalInfo,
            address,
            documents: documents || {},
            vehicleInfo,
            workInfo: workInfo || {
                preferredAreas: [],
                availabilityHours: { start: '09:00', end: '18:00' },
                workingDays: [],
                expectedSalary: 0,
                experience: ''
            },
            emergencyContact,
            authentication: {
                password,
                isEmailVerified: false,
                isPhoneVerified: false
            },
            status: {
                applicationStatus: 'pending',
                isActive: false,
                isOnline: false
            }
        });

        await newAgent.save();

        res.status(201).json({
            success: true,
            message: 'Application submitted successfully. You will be notified once reviewed.',
            agentId: newAgent._id
        });
    } catch (error) {
        console.error('Delivery agent signup error:', error);
        
        if (error.code === 11000) {
            return res.status(400).json({
                success: false,
                message: 'Email or phone number already exists'
            });
        }
        
        res.status(500).json({ 
            success: false, 
            message: 'Server error: ' + error.message 
        });
    }
});

// Get all delivery agents with filters
router.get('/', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const { status, zone, search, applicationStatus } = req.query;

        let query = {};

        if (status) {
            query['status.isActive'] = status === 'active';
        }

        if (zone) {
            query['status.deliveryZone'] = zone;
        }

        if (applicationStatus) {
            query['status.applicationStatus'] = applicationStatus;
        }

        if (search) {
            query.$or = [
                { 'personalInfo.firstName': { $regex: search, $options: 'i' } },
                { 'personalInfo.lastName': { $regex: search, $options: 'i' } },
                { 'personalInfo.email': { $regex: search, $options: 'i' } },
                { 'personalInfo.phone': { $regex: search, $options: 'i' } }
            ];
        }

        const agents = await DeliveryAgent.find(query)
            .populate('verification.verifiedBy', 'name email')
            .select('-authentication.password -documents.bankAccount')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await DeliveryAgent.countDocuments(query);

        res.json({
            success: true,
            agents,
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
        console.error('Get delivery agents error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get delivery agent by ID
router.get('/:id', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.params.id)
            .populate('verification.verifiedBy', 'name email')
            .select('-authentication.password');

        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        res.json({
            success: true,
            agent
        });
    } catch (error) {
        console.error('Get delivery agent error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update delivery agent application status
router.put('/:id/status', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { applicationStatus, rejectionReason, deliveryZone } = req.body;

        const updateData = {
            'status.applicationStatus': applicationStatus
        };

        if (applicationStatus === 'approved') {
            updateData['status.isActive'] = true;
            updateData['verification.documentsVerified'] = true;
            updateData['verification.verifiedBy'] = req.user.adminId;
            updateData['verification.verifiedAt'] = new Date();

            if (deliveryZone) {
                updateData['status.deliveryZone'] = deliveryZone;
            }
        } else if (applicationStatus === 'rejected') {
            updateData['status.isActive'] = false;
            updateData['verification.rejectionReason'] = rejectionReason;
        }

        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: `Application ${applicationStatus} successfully`,
            agent
        });
    } catch (error) {
        console.error('Update agent status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Assign delivery zone to agent
router.put('/:id/zone', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { deliveryZone } = req.body;

        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.params.id,
            { 'status.deliveryZone': deliveryZone },
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: 'Delivery zone assigned successfully',
            agent
        });
    } catch (error) {
        console.error('Assign zone error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent statistics
router.get('/stats/overview', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const stats = await DeliveryAgent.aggregate([
            {
                $group: {
                    _id: '$status.applicationStatus',
                    count: { $sum: 1 }
                }
            }
        ]);

        const activeAgents = await DeliveryAgent.countDocuments({ 'status.isActive': true });
        const onlineAgents = await DeliveryAgent.countDocuments({ 'status.isOnline': true });
        const totalDeliveries = await DeliveryAgent.aggregate([
            {
                $group: {
                    _id: null,
                    total: { $sum: '$status.totalDeliveries' }
                }
            }
        ]);

        const formattedStats = {
            total: await DeliveryAgent.countDocuments(),
            active: activeAgents,
            online: onlineAgents,
            totalDeliveries: totalDeliveries[0]?.total || 0,
            applicationStatus: {}
        };

        stats.forEach(stat => {
            formattedStats.applicationStatus[stat._id] = stat.count;
        });

        res.json({
            success: true,
            stats: formattedStats
        });
    } catch (error) {
        console.error('Get agent stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Approve delivery agent application
router.put('/:id/approve', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { deliveryZone } = req.body || {};

        const agent = await DeliveryAgent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        if (agent.status.applicationStatus !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot approve application with status: ${agent.status.applicationStatus}` 
            });
        }

        const updateData = {
            'status.applicationStatus': 'approved',
            'status.isActive': true,
            'verification.documentsVerified': true,
            'verification.verifiedBy': req.user.adminId,
            'verification.verifiedAt': new Date()
        };

        if (deliveryZone) {
            updateData['status.deliveryZone'] = deliveryZone;
        }

        const updatedAgent = await DeliveryAgent.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: 'Application approved successfully',
            agent: updatedAgent
        });
    } catch (error) {
        console.error('Approve agent error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Reject delivery agent application
router.put('/:id/reject', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const { rejectionReason } = req.body || {};

        const agent = await DeliveryAgent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        if (agent.status.applicationStatus !== 'pending') {
            return res.status(400).json({ 
                success: false, 
                message: `Cannot reject application with status: ${agent.status.applicationStatus}` 
            });
        }

        const updateData = {
            'status.applicationStatus': 'rejected',
            'status.isActive': false,
            'verification.rejectionReason': rejectionReason || 'Application rejected by admin'
        };

        const updatedAgent = await DeliveryAgent.findByIdAndUpdate(
            req.params.id,
            updateData,
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: 'Application rejected successfully',
            agent: updatedAgent
        });
    } catch (error) {
        console.error('Reject agent error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent statistics for specific agent
router.get('/:id/stats', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.params.id).select('status');
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        // For now, return basic stats from the agent model
        // In a real application, you might aggregate from orders collection
        const stats = {
            totalDeliveries: agent.status.totalDeliveries || 0,
            completedDeliveries: agent.status.completedDeliveries || 0,
            successRate: agent.status.totalDeliveries > 0 
                ? Math.round((agent.status.completedDeliveries / agent.status.totalDeliveries) * 100)
                : 0,
            totalEarnings: agent.status.earnings?.total || 0,
            thisMonthEarnings: agent.status.earnings?.thisMonth || 0,
            rating: agent.status.rating || 5.0
        };

        res.json({
            success: true,
            stats
        });
    } catch (error) {
        console.error('Get agent stats error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent orders (placeholder - would integrate with orders system)
router.get('/:id/orders', protectWithRole(['super_admin', 'admin', 'delivery_manager']), async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.params.id);
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Delivery agent not found' });
        }

        // Placeholder response - in real implementation, you would query orders collection
        // where deliveryAgent field matches the agent ID
        const orders = [];

        res.json({
            success: true,
            orders,
            message: 'No orders found for this agent'
        });
    } catch (error) {
        console.error('Get agent orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Delete delivery agent (Soft delete - deactivate)
router.delete('/:id', protectWithRole(['super_admin', 'admin']), async (req, res) => {
    try {
        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.params.id,
            {
                'status.isActive': false,
                'status.applicationStatus': 'suspended'
            },
            { new: true }
        );

        res.json({
            success: true,
            message: 'Delivery agent suspended successfully',
            agent
        });
    } catch (error) {
        console.error('Suspend agent error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
