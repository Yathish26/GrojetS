import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protectNative } from '../middleware/authMiddleware.js';

const router = express.Router();

// MSG91 Configuration
const MSG91_API_KEY = process.env.MSG91_API_KEY || 'your_msg91_api_key_here';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'your_template_id_here';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';

// In-memory OTP storage (consider using Redis in production)
const otpStorage = new Map();

// Generate OTP
const generateOTP = () => {
    return Math.floor(100000 + Math.random() * 900000).toString();
};

// Send OTP via MSG91
const sendOTP = async (phoneNumber, otp) => {
    try {
        const response = await fetch('https://api.msg91.com/api/v5/otp', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'authkey': MSG91_API_KEY
            },
            body: JSON.stringify({
                template_id: MSG91_TEMPLATE_ID,
                mobile: phoneNumber,
                authkey: MSG91_API_KEY,
                otp: otp,
                otp_expiry: 5 // 5 minutes
            })
        });

        const data = await response.json();
        return { success: response.ok, data };
    } catch (error) {
        console.error('MSG91 Error:', error);
        return { success: false, error: error.message };
    }
};

// Route: Send OTP
router.post('/send-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        // Validate phone number
        if (!phoneNumber || !/^[6-9]\d{9}$/.test(phoneNumber)) {
            return res.status(400).json({
                success: false,
                message: 'Please provide a valid 10-digit Indian mobile number'
            });
        }

        // Generate OTP
        const otp = generateOTP();
        const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP in memory
        otpStorage.set(phoneNumber, {
            otp,
            expiryTime,
            attempts: 0
        });

        // Send OTP via MSG91
        const result = await sendOTP(phoneNumber, otp);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'OTP sent successfully',
                requestId: result.data.request_id
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to send OTP'
            });
        }

    } catch (error) {
        console.error('Send OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Route: Verify OTP and Login/Register
router.post('/verify-otp', async (req, res) => {
    try {
        const { phoneNumber, otp } = req.body;

        // Validate input
        if (!phoneNumber || !otp) {
            return res.status(400).json({
                success: false,
                message: 'Phone number and OTP are required'
            });
        }

        // Check if OTP exists and is valid
        const storedOTPData = otpStorage.get(phoneNumber);
        
        if (!storedOTPData) {
            return res.status(400).json({
                success: false,
                message: 'OTP not found or expired'
            });
        }

        // Check expiry
        if (Date.now() > storedOTPData.expiryTime) {
            otpStorage.delete(phoneNumber);
            return res.status(400).json({
                success: false,
                message: 'OTP has expired'
            });
        }

        // Check attempts
        if (storedOTPData.attempts >= 3) {
            otpStorage.delete(phoneNumber);
            return res.status(400).json({
                success: false,
                message: 'Too many failed attempts. Please request a new OTP'
            });
        }

        // Verify OTP
        if (storedOTPData.otp !== otp) {
            storedOTPData.attempts += 1;
            return res.status(400).json({
                success: false,
                message: 'Invalid OTP'
            });
        }

        // OTP verified successfully, remove from storage
        otpStorage.delete(phoneNumber);

        // Check if user exists
        let user = await User.findOne({ 'personalInfo.phone': phoneNumber });

        if (!user) {
            // Create new user
            user = new User({
                personalInfo: {
                    name: `User ${phoneNumber.slice(-4)}`, // Default name
                    email: `${phoneNumber}@grojet.temp`, // Temporary email
                    phone: phoneNumber
                },
                authentication: {
                    password: 'otp_login', // Placeholder password for OTP users
                    isPhoneVerified: true,
                    lastLogin: new Date()
                }
            });

            await user.save();
        } else {
            // Update existing user
            user.authentication.isPhoneVerified = true;
            user.authentication.lastLogin = new Date();
            await user.save();
        }

        // Generate JWT token
        const token = jwt.sign(
            { 
                userId: user._id,
                phone: phoneNumber 
            },
            JWT_SECRET,
            { expiresIn: '30d' }
        );

        // Return user data and token
        res.status(200).json({
            success: true,
            message: 'Login successful',
            user: {
                id: user._id,
                name: user.personalInfo.name,
                phone: user.personalInfo.phone,
                email: user.personalInfo.email,
                isPhoneVerified: user.authentication.isPhoneVerified
            },
            token
        });

    } catch (error) {
        console.error('Verify OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

// Route: Resend OTP
router.post('/resend-otp', async (req, res) => {
    try {
        const { phoneNumber } = req.body;

        if (!phoneNumber) {
            return res.status(400).json({
                success: false,
                message: 'Phone number is required'
            });
        }

        // Generate new OTP
        const otp = generateOTP();
        const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store new OTP
        otpStorage.set(phoneNumber, {
            otp,
            expiryTime,
            attempts: 0
        });

        // Send OTP via MSG91
        const result = await sendOTP(phoneNumber, otp);

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'OTP resent successfully'
            });
        } else {
            res.status(500).json({
                success: false,
                message: 'Failed to resend OTP'
            });
        }

    } catch (error) {
        console.error('Resend OTP Error:', error);
        res.status(500).json({
            success: false,
            message: 'Server error'
        });
    }
});

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
