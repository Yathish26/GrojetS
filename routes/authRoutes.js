import express from 'express';
import User from '../models/User.js';
import { protectNative } from '../middleware/authMiddleware.js';

const router = express.Router();

const otpStorage = new Map();
router.get('/me', protectNative, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('name phoneNumber isPhoneVerified createdAt');
        if (!user) {
            return res.status(404).json({ 
                success: false,
                message: 'User not found' 
            });
        }
        res.status(200).json({ 
            success: true, 
            user 
        });
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ 
            success: false,
            message: 'Server error' 
        });
    }
});

router.post('/webhooks/grojetotp', async (req, res) => {
    try {
        const webhookData = req.body;
        console.log('Received GrojetOTP Webhook Event:', webhookData);
        if (webhookData.event_type === 'otp_sent') {
            console.log(`OTP sent to ${webhookData.phoneNumber} with status: ${webhookData.status}`);
        } else if (webhookData.event_type === 'otp_verified') {
            console.log(`OTP verified for ${webhookData.phoneNumber}.`);
            let user = await User.findOne({ phoneNumber: webhookData.phoneNumber });
            if (user && !user.isPhoneVerified) {
                user.isPhoneVerified = true;
                await user.save();
                console.log(`User ${user.name} (${user.phoneNumber}) marked as phone verified.`);
            }
        } else if (webhookData.event_type === 'otp_failed') {
            console.log(`OTP failed for ${webhookData.phoneNumber}. Reason: ${webhookData.reason}`);
        } else {
            console.log('Unhandled GrojetOTP webhook event type:', webhookData.event_type);
        }
        res.status(200).send('Webhook received successfully');
    } catch (err) {
        console.error('GrojetOTP Webhook error:', err);
        res.status(500).send('Internal Server Error'); 
    }
});

setInterval(() => {
    const now = Date.now();
    for (const [phone, data] of otpStorage.entries()) {
        if (now > data.expiryTime) {
            otpStorage.delete(phone);
        }
    }
}, 60000);

export default router;
