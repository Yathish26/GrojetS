import express from 'express';
import jwt from 'jsonwebtoken';
import DeliveryAgent from '../../models/DeliveryAgent.js';
import { protectNative } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Delivery agent login for React Native (returns token instead of cookie)
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find agent and include password field
        const agent = await DeliveryAgent.findOne({ 'personalInfo.email': email })
            .select('+authentication.password');
        
        if (!agent) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if application is approved
        if (agent.status.applicationStatus !== 'approved') {
            return res.status(400).json({ 
                success: false, 
                message: `Application is ${agent.status.applicationStatus}. Please contact support.` 
            });
        }

        // Check if agent is active
        if (!agent.status.isActive) {
            return res.status(400).json({ 
                success: false, 
                message: 'Account is suspended. Contact admin.' 
            });
        }

        // Verify password
        const isMatch = await agent.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login and set online
        agent.authentication.lastLogin = new Date();
        agent.status.isOnline = true;
        await agent.save();

        const token = jwt.sign(
            { 
                agentId: agent._id,
                email: agent.personalInfo.email,
                zone: agent.status.deliveryZone
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token,
            agent: {
                id: agent._id,
                name: `${agent.personalInfo.firstName} ${agent.personalInfo.lastName}`,
                email: agent.personalInfo.email,
                phone: agent.personalInfo.phone,
                zone: agent.status.deliveryZone,
                rating: agent.status.rating,
                totalDeliveries: agent.status.totalDeliveries,
                earnings: agent.status.earnings
            }
        });
    } catch (err) {
        console.error('Delivery agent login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent profile (React Native)
router.get('/profile', protectNative, async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.user.agentId)
            .select('-authentication.password -documents.bankAccount');
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        res.json({
            success: true,
            agent
        });
    } catch (error) {
        console.error('Get agent profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update agent online status (React Native)
router.put('/status/online', protectNative, async (req, res) => {
    try {
        const { isOnline } = req.body;
        
        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.user.agentId,
            { 'status.isOnline': isOnline },
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: `Status updated to ${isOnline ? 'online' : 'offline'}`,
            agent
        });
    } catch (error) {
        console.error('Update online status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update agent location (React Native)
router.put('/location', protectNative, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        const agent = await DeliveryAgent.findById(req.user.agentId);
        await agent.updateLocation(latitude, longitude);

        res.json({
            success: true,
            message: 'Location updated successfully'
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout (React Native)
router.post('/logout', protectNative, async (req, res) => {
    try {
        // Set agent offline
        await DeliveryAgent.findByIdAndUpdate(
            req.user.agentId,
            { 'status.isOnline': false }
        );

        res.status(200).json({
            success: true,
            message: 'Logged out successfully'
        });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;
