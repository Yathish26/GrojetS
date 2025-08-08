import express from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protectNative } from '../middleware/authMiddleware.js';
import nodemailer from 'nodemailer';

const router = express.Router();

// MSG91 Configuration (support both env var names)
const MSG91_API_KEY = process.env.MSG91_API_KEY || process.env.MSG91_AUTH_KEY || 'your_msg91_api_key_here';
const MSG91_TEMPLATE_ID = process.env.MSG91_TEMPLATE_ID || 'your_template_id_here';
const JWT_SECRET = process.env.JWT_SECRET || 'your_jwt_secret_here';
const IS_DEV = process.env.NODE_ENV === 'development';

// In-memory OTP storage (consider using Redis in production)
const otpStorage = new Map();
// In-memory Email OTP storage keyed by userId
const emailOtpStorage = new Map();

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

// Email OTP sender (Gmail preferred, fallback to console in dev)
const createMailTransport = () => {
    if (process.env.GMAIL_USER && process.env.GMAIL_APP_PASSWORD) {
        return nodemailer.createTransport({
            service: 'gmail',
            auth: {
                user: process.env.GMAIL_USER,
                pass: process.env.GMAIL_APP_PASSWORD
            }
        });
    }
    // Development: stream to console
    return {
        sendMail: async ({ to, subject, text, html }) => {
            console.log(`[DEV] Email to ${to}: ${subject}\n${text || html}`);
            return { messageId: 'dev-email' };
        }
    };
};
const mailer = createMailTransport();

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

        // Generate OTP (fixed in development)
        // Always use a random OTP for email verification (even in development)
        const otp = generateOTP();
        const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store OTP in memory
        otpStorage.set(phoneNumber, {
            otp,
            expiryTime,
            attempts: 0
        });

        // Send OTP via MSG91 (skip external call in development)
        let result;
        if (IS_DEV) {
            console.log(`[DEV] OTP for ${phoneNumber}: ${otp}`);
            result = { success: true, data: { request_id: 'dev-request-id' } };
        } else {
            result = await sendOTP(phoneNumber, otp);
        }

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'OTP sent successfully',
                requestId: result.data.request_id
            });
        } else {
            // In development, still return success even if external service fails
            if (IS_DEV) {
                return res.status(200).json({
                    success: true,
                    message: 'OTP sent successfully (dev)'
                });
            }
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
        let isNewUser = false;
        let user = await User.findOne({ 'personalInfo.phone': phoneNumber });

        if (!user) {
            // Create new user without default name, inactive until name is set
            user = new User({
                personalInfo: {
                    phone: phoneNumber
                },
                authentication: {
                    password: 'otp_login', // Placeholder password for OTP users
                    isPhoneVerified: true,
                    lastLogin: new Date()
                },
                status: {
                    isActive: false
                }
            });

            await user.save();
            isNewUser = true;
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
                isPhoneVerified: user.authentication.isPhoneVerified,
                isEmailVerified: user.authentication.isEmailVerified,
                isActive: user.status?.isActive === true
            },
            token,
            isNewUser
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

        // Generate new OTP (fixed in development)
        const otp = generateOTP();
        const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes

        // Store new OTP
        otpStorage.set(phoneNumber, {
            otp,
            expiryTime,
            attempts: 0
        });

        // Send OTP via MSG91 (skip external call in development)
        let result;
        if (IS_DEV) {
            console.log(`[DEV] Resent OTP for ${phoneNumber}: ${otp}`);
            result = { success: true, data: { request_id: 'dev-request-id' } };
        } else {
            result = await sendOTP(phoneNumber, otp);
        }

        if (result.success) {
            res.status(200).json({
                success: true,
                message: 'OTP resent successfully'
            });
        } else {
            // In development, still return success even if external service fails
            if (IS_DEV) {
                return res.status(200).json({
                    success: true,
                    message: 'OTP resent successfully (dev)'
                });
            }
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

// Request Email OTP for verification (does not set email yet)
router.post('/email/request-otp', protectNative, async (req, res) => {
    try {
        const { email } = req.body;
        if (!email || typeof email !== 'string') {
            return res.status(400).json({ success: false, message: 'Email is required' });
        }
        const normalized = email.trim().toLowerCase();
        // Basic format check
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(normalized)) {
            return res.status(400).json({ success: false, message: 'Invalid email format' });
        }
        // Ensure not used by another user
        const existing = await User.findOne({ 'personalInfo.email': normalized });
        if (existing && existing._id.toString() !== req.user.userId) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        const otp = generateOTP();
        const expiryTime = Date.now() + 5 * 60 * 1000; // 5 minutes
        emailOtpStorage.set(req.user.userId, { otp, expiryTime, attempts: 0, pendingEmail: normalized });

        // Send email
        const subject = 'Verify your email for Grojet';
        const body = `Your verification code is ${otp}. It expires in 5 minutes.`;
        const html = `
                        <div style="font-family: Arial, sans-serif; max-width: 520px; margin: 0 auto; color: #111827;">
                            <div style="text-align:center; padding: 20px 0;">
                                <img src="https://grojetdelivery.com/icons/icon-192x192.png" alt="Grojet" width="56" height="56" style="border-radius:12px"/>
                                <h2 style="margin: 12px 0 0; color:#16a34a;">Grojet</h2>
                            </div>
                            <div style="background:#ffffff; border:1px solid #e5e7eb; border-radius:12px; padding:24px;">
                                <h3 style="margin:0 0 8px; color:#111827;">Email Verification</h3>
                                <p style="margin:0 0 16px; color:#4b5563;">Use the following one-time code to verify your email address. This code expires in 5 minutes.</p>
                                <div style="background:#f0fdf4; border:1px solid #bbf7d0; border-radius:10px; padding:16px; text-align:center; letter-spacing:4px;">
                                    <span style="font-size:28px; font-weight:700; color:#16a34a;">${otp}</span>
                                </div>
                                <p style="margin:16px 0 0; color:#6b7280; font-size:12px;">If you didn’t request this, you can safely ignore this email.</p>
                            </div>
                            <p style="text-align:center; color:#9ca3af; font-size:12px; margin-top:16px;">© ${new Date().getFullYear()} Grojet</p>
                        </div>
                `;
        try {
            await mailer.sendMail({ to: normalized, from: process.env.GMAIL_USER || process.env.MAIL_FROM || 'no-reply@grojet.app', subject, text: body, html });
        } catch (err) {
            if (!IS_DEV) {
                console.error('Email send error:', err.message);
                return res.status(500).json({ success: false, message: 'Failed to send email OTP' });
            }
        }

        return res.json({ success: true, message: 'Email OTP sent' });
    } catch (err) {
        console.error('Email request OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Verify Email OTP and set email + isEmailVerified
router.post('/email/verify-otp', protectNative, async (req, res) => {
    try {
        const { otp } = req.body;
        if (!otp) return res.status(400).json({ success: false, message: 'OTP is required' });

        const record = emailOtpStorage.get(req.user.userId);
        if (!record) return res.status(400).json({ success: false, message: 'OTP not found or expired' });
        if (Date.now() > record.expiryTime) {
            emailOtpStorage.delete(req.user.userId);
            return res.status(400).json({ success: false, message: 'OTP has expired' });
        }
        if (record.attempts >= 3) {
            emailOtpStorage.delete(req.user.userId);
            return res.status(400).json({ success: false, message: 'Too many failed attempts' });
        }
        if (record.otp !== otp) {
            record.attempts += 1;
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }

        // Apply email and mark verified
        const user = await User.findById(req.user.userId);
        if (!user) return res.status(404).json({ success: false, message: 'User not found' });
        // Check again that email isn't taken by another (race condition)
        const normalized = record.pendingEmail;
        const existing = await User.findOne({ 'personalInfo.email': normalized });
        if (existing && existing._id.toString() !== req.user.userId) {
            emailOtpStorage.delete(req.user.userId);
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }

        user.personalInfo.email = normalized;
        user.authentication.isEmailVerified = true;
        await user.save();
        emailOtpStorage.delete(req.user.userId);

        return res.json({
            success: true,
            message: 'Email verified',
            user: {
                id: user._id,
                name: user.personalInfo.name,
                phone: user.personalInfo.phone,
                email: user.personalInfo.email,
                gender: user.personalInfo.gender,
                dateOfBirth: user.personalInfo.dateOfBirth,
                isPhoneVerified: user.authentication.isPhoneVerified,
                isEmailVerified: user.authentication.isEmailVerified,
            }
        });
    } catch (err) {
        console.error('Email verify OTP error:', err);
        return res.status(500).json({ success: false, message: 'Server error' });
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

// Route: Complete profile (optional name/email)
router.post('/complete-profile', protectNative, async (req, res) => {
    try {
        const { name, email } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Update only provided fields
        if (typeof name === 'string' && name.trim()) {
            user.personalInfo.name = name.trim();
            user.status.isActive = true;
        }
        if (typeof email === 'string' && email.trim()) {
            const trimmed = email.trim().toLowerCase();
            // If attempting to set/modify email here, enforce verification flow
            if (!user.personalInfo.email || user.personalInfo.email !== trimmed) {
                return res.status(400).json({ success: false, message: 'Please verify email via OTP first' });
            }
        }

        await user.save();
        return res.status(200).json({
            success: true,
            message: 'Profile updated',
            user: {
                id: user._id,
                name: user.personalInfo.name,
                phone: user.personalInfo.phone,
                email: user.personalInfo.email,
                isPhoneVerified: user.authentication.isPhoneVerified,
                isEmailVerified: user.authentication.isEmailVerified,
                isActive: user.status?.isActive === true
            }
        });
    } catch (err) {
        console.error('Complete profile error:', err);
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern['personalInfo.email']) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }
        return res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Route: Edit profile (PUT)
router.put('/edit-profile', protectNative, async (req, res) => {
    try {
        const { name, email, gender, dateOfBirth } = req.body;
        const user = await User.findById(req.user.userId);
        if (!user) {
            return res.status(404).json({ success: false, message: 'User not found' });
        }

        // Basic validation
        if (typeof name === 'string' && !name.trim()) {
            return res.status(400).json({ success: false, message: 'Name cannot be empty' });
        }
        const allowedGenders = ['male', 'female', 'other'];
        if (gender && !allowedGenders.includes(gender)) {
            return res.status(400).json({ success: false, message: 'Invalid gender' });
        }
        let parsedDob = null;
        if (dateOfBirth) {
            const d = new Date(dateOfBirth);
            if (isNaN(d.getTime())) {
                return res.status(400).json({ success: false, message: 'Invalid date of birth' });
            }
            parsedDob = d;
        }

        // Apply updates if provided
        if (typeof name === 'string') {
            user.personalInfo.name = name.trim();

            if (name.trim()) {
                user.status = user.status || {};
                user.status.isActive = true;
            }
        }
        if (typeof email === 'string') {
            const trimmed = email.trim().toLowerCase();
            if (!trimmed) {
                user.personalInfo.email = undefined;
                user.authentication.isEmailVerified = false;
            } else if (trimmed !== (user.personalInfo.email || '').toLowerCase()) {
                // Enforce verification via OTP before changing email
                return res.status(400).json({ success: false, message: 'Please verify email via OTP first' });
            }
        }
        if (gender) user.personalInfo.gender = gender;
        if (parsedDob) user.personalInfo.dateOfBirth = parsedDob;

        await user.save();
        return res.status(200).json({
            success: true,
            message: 'Profile updated',
            user: {
                id: user._id,
                name: user.personalInfo.name,
                phone: user.personalInfo.phone,
                email: user.personalInfo.email,
                gender: user.personalInfo.gender,
                dateOfBirth: user.personalInfo.dateOfBirth,
                isPhoneVerified: user.authentication.isPhoneVerified,
                isEmailVerified: user.authentication.isEmailVerified,
                isActive: user.status?.isActive === true
            }
        });
    } catch (err) {
        console.error('Edit profile error:', err);
        if (err && err.code === 11000 && err.keyPattern && err.keyPattern['personalInfo.email']) {
            return res.status(400).json({ success: false, message: 'Email already in use' });
        }
        return res.status(500).json({ success: false, message: 'Server error' });
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
