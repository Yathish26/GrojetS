import express from 'express';
import jwt from 'jsonwebtoken';
import nodemailer from 'nodemailer';
import Admin from '../../models/Admin.js';
import Settings from '../../models/Settings.js';
import bcrypt from 'bcryptjs';
import { protectWithRole, checkPermission } from '../../middleware/authMiddleware.js';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

// PIN now stored in DB
const AUTHORIZED_EMAIL = process.env.AUTHORIZED_EMAIL

// Store OTPs temporarily (in production, use Redis or database)
const otpStore = new Map();

// Gmail transporter configuration
const createTransporter = () => {
    return nodemailer.createTransport({
        service: 'gmail',
        auth: {
            user: process.env.GMAIL_USER,
            pass: process.env.GMAIL_APP_PASSWORD
        }
    });
};

// Step 1: Verify PIN for admin registration
// Verify PIN for admin registration (from DB)
router.post('/verify-pin', async (req, res) => {
    try {
        const { pin } = req.body;
        if (!pin) {
            return res.status(400).json({ success: false, message: 'PIN is required' });
        }
        const settings = await Settings.findOne();
        if (!settings || !settings.adminRegistrationPin) {
            return res.status(500).json({ success: false, message: 'PIN not set. Contact super admin.' });
        }
        const isMatch = await bcrypt.compare(pin, settings.adminRegistrationPin);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid PIN' });
        }
        // Generate and send OTP
        const otp = Math.floor(100000 + Math.random() * 900000).toString(); // 6-digit OTP
        const otpExpiry = Date.now() + 10 * 60 * 1000; // 10 minutes expiry
        otpStore.set(AUTHORIZED_EMAIL, { otp, expiry: otpExpiry });
        try {
            const transporter = createTransporter();
            const mailOptions = {
                from: process.env.GMAIL_USER || 'noreply@grojet.com',
                to: AUTHORIZED_EMAIL,
                subject: 'Admin Registration Authorization - OTP',
                html: `
                    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
                        <h2 style="color: #16a34a;">Grojet Admin Registration</h2>
                        <p>Someone is trying to access the admin registration panel.</p>
                        <div style="background-color: #f0f9ff; padding: 20px; border-radius: 8px; margin: 20px 0;">
                            <h3 style="color: #1e40af; margin: 0;">Your OTP Code:</h3>
                            <p style="font-size: 24px; font-weight: bold; color: #16a34a; margin: 10px 0; letter-spacing: 2px;">${otp}</p>
                        </div>
                        <p style="color: #666;">This OTP will expire in 10 minutes.</p>
                        <p style="color: #666;">If you didn't request this, please ignore this email.</p>
                        <hr style="margin: 20px 0; border: none; border-top: 1px solid #e5e7eb;">
                        <p style="color: #888; font-size: 12px;">This is an automated message from Grojet Admin System.</p>
                    </div>
                `
            };
            await transporter.sendMail(mailOptions);
            res.status(200).json({ 
                success: true, 
                message: 'PIN verified successfully. OTP sent to authorized email.' 
            });
        } catch (emailError) {
            console.error('Email sending error:', emailError);
            res.status(500).json({ 
                success: false, 
                message: 'PIN verified but failed to send OTP. Please try again.' 
            });
        }
    } catch (error) {
        console.error('PIN verification error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});
// Super admin: change admin registration PIN
router.put('/settings/pin', protectWithRole(['super_admin']), async (req, res) => {
    try {
        const { newPin } = req.body;
        if (!newPin || newPin.length < 4) {
            return res.status(400).json({ success: false, message: 'PIN must be at least 4 digits.' });
        }
        const hashedPin = await bcrypt.hash(newPin, 10);
        let settings = await Settings.findOne();
        if (!settings) {
            settings = new Settings({ adminRegistrationPin: hashedPin, updatedBy: req.user.adminId });
        } else {
            settings.adminRegistrationPin = hashedPin;
            settings.updatedBy = req.user.adminId;
            settings.updatedAt = new Date();
        }
        await settings.save();
        res.json({ success: true, message: 'Admin registration PIN updated successfully.' });
    } catch (error) {
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Step 2: Verify OTP for admin registration
router.post('/verify-otp', async (req, res) => {
    try {
        const { otp } = req.body;
        
        if (!otp) {
            return res.status(400).json({ success: false, message: 'OTP is required' });
        }
        
        const storedData = otpStore.get(AUTHORIZED_EMAIL);
        
        if (!storedData) {
            return res.status(400).json({ success: false, message: 'No OTP found. Please request a new one.' });
        }
        
        if (Date.now() > storedData.expiry) {
            otpStore.delete(AUTHORIZED_EMAIL);
            return res.status(400).json({ success: false, message: 'OTP has expired. Please request a new one.' });
        }
        
        if (otp !== storedData.otp) {
            return res.status(400).json({ success: false, message: 'Invalid OTP' });
        }
        
        // OTP verified successfully, remove from store
        otpStore.delete(AUTHORIZED_EMAIL);
        
        // Generate a temporary authorization token for admin registration
        const authToken = jwt.sign(
            { authorized: true, purpose: 'admin_registration' },
            process.env.JWT_SECRET,
            { expiresIn: '30m' } // 30 minutes to complete registration
        );
        
        res.status(200).json({ 
            success: true, 
            message: 'OTP verified successfully. You can now proceed with admin registration.',
            authToken
        });
        
    } catch (error) {
        console.error('OTP verification error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Enhanced login with admin model
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        
        // Find admin and include password field
        const admin = await Admin.findOne({ email }).select('+password');
        
        if (!admin) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Check if admin is active
        if (!admin.isActive) {
            return res.status(400).json({ success: false, message: 'Account is suspended. Contact super admin.' });
        }

        // Verify password
        const isMatch = await admin.matchPassword(password);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        // Update last login
        admin.lastLogin = new Date();
        await admin.save();

        const token = jwt.sign(
            { 
                adminId: admin._id,
                role: admin.role,
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '8h' }
        );

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            maxAge: 8 * 60 * 60 * 1000, // 8 hours
            sameSite: isProduction ? 'none' : 'lax',
        };

        if (isProduction) {
            cookieOptions.domain = '.grojetdelivery.com';
        }

        res
            .cookie('admin_token', token, cookieOptions)
            .status(200)
            .json({
                success: true,
                message: 'Logged in successfully',
                admin: {
                    name: admin.name,
                    email: admin.email,
                    role: admin.role,
                    lastLogin: admin.lastLogin,
                    createdAt: admin.createdAt,
                    department: admin.department,
                    passwordLastChanged: admin.passwordLastChanged,
                    twofactorAuth: admin.twofactorAuth,
                    phone: admin.phone,
                    department: admin.department
                }
            });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get current admin profile
router.get('/profile', protectWithRole(), async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.adminId)
            .populate('createdBy', 'name email')
            .select('-password');
        
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        res.json({
            success: true,
            admin
        });
    } catch (error) {
        console.error('Get admin profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update admin profile
router.put('/profile', protectWithRole(), async (req, res) => {
    try {
        const { name, email, phone, department } = req.body;
        
        const admin = await Admin.findByIdAndUpdate(
            req.user.adminId,
            { name, email, phone, department },
            { new: true, runValidators: true }
        ).select('-password');

        res.json({
            success: true,
            message: 'Profile updated successfully',
            admin
        });
    } catch (error) {
        console.error('Update admin profile error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Create new admin (Requires PIN+OTP authorization)
router.post('/create', async (req, res) => {
    try {
        // Check for authorization token
        const authHeader = req.headers.authorization;
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            return res.status(403).json({ 
                success: false, 
                message: 'Authorization required. Please complete PIN and OTP verification.' 
            });
        }

        const authToken = authHeader.split(' ')[1];
        
        try {
            const decoded = jwt.verify(authToken, process.env.JWT_SECRET);
            if (!decoded.authorized || decoded.purpose !== 'admin_registration') {
                return res.status(403).json({ 
                    success: false, 
                    message: 'Invalid authorization token.' 
                });
            }
        } catch (tokenError) {
            return res.status(403).json({ 
                success: false, 
                message: 'Authorization token expired or invalid. Please verify PIN and OTP again.' 
            });
        }

        const { name, email, password, role, phone, department } = req.body;

        // Validate required fields
        if (!name || !email || !password) {
            return res.status(400).json({ 
                success: false, 
                message: 'Name, email, and password are required' 
            });
        }

        const existingAdmin = await Admin.findOne({ email });
        if (existingAdmin) {
            return res.status(400).json({ success: false, message: 'Admin with this email already exists' });
        }

        const newAdmin = new Admin({
            name,
            email,
            password,
            role: role || 'admin',
            phone,
            department
        });

        await newAdmin.save();

        res.status(201).json({
            success: true,
            message: 'Admin created successfully',
            admin: {
                id: newAdmin._id,
                name: newAdmin.name,
                email: newAdmin.email,
                role: newAdmin.role,
            }
        });
    } catch (error) {
        console.error('Create admin error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


// Get all admins (Super Admin only)
router.get('/all', protectWithRole(['super_admin']), async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const admins = await Admin.find({})
            .populate('createdBy', 'name email')
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limit);

        const total = await Admin.countDocuments();

        res.json({
            success: true,
            admins,
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
        console.error('Get all admins error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update admin status (Super Admin only)
router.put('/status/:adminId', protectWithRole(['super_admin']), async (req, res) => {
    try {
        const { adminId } = req.params;
        const { isActive } = req.body;

        // Prevent super admin from deactivating themselves
        if (adminId === req.user.adminId) {
            return res.status(400).json({ success: false, message: 'Cannot deactivate your own account' });
        }

        const admin = await Admin.findByIdAndUpdate(
            adminId,
            { isActive },
            { new: true }
        ).select('-password');

        res.json({
            success: true,
            message: `Admin ${isActive ? 'activated' : 'deactivated'} successfully`,
            admin
        });
    } catch (error) {
        console.error('Update admin status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.put('/change-password', protectWithRole(), async (req, res) => {
    try {
        const { currentPassword, newPassword } = req.body;

        if (!currentPassword || !newPassword) {
            return res.status(400).json({ success: false, message: 'Current and new password are required' });
        }

        const admin = await Admin.findById(req.user.adminId).select('+password');
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        const isMatch = await admin.matchPassword(currentPassword);
        if (!isMatch) {
            return res.status(400).json({ success: false, message: 'Current password is incorrect' });
        }

        admin.password = newPassword;
        admin.passwordLastChanged = new Date();
        await admin.save();

        res.json({ success: true, message: 'Password changed successfully' });
    } catch (error) {
        console.error('Change password error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});


router.post('/2fa', protectWithRole(), async (req, res) => {
    try {
        const admin = await Admin.findById(req.user.adminId);
        if (!admin) {
            return res.status(404).json({ success: false, message: 'Admin not found' });
        }

        admin.twofactorAuth = !admin.twofactorAuth;
        await admin.save();

        res.json({ success: true, message: `Two-factor authentication ${admin.twofactorAuth ? 'enabled' : 'disabled'} successfully` });
    } catch (error) {
        console.error('Toggle 2FA error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    const cookieOptions = {
        httpOnly: true,
        secure: isProduction,
        sameSite: isProduction ? 'none' : 'lax',
    };
    if (isProduction) {
        cookieOptions.domain = '.grojetdelivery.com';
    }

    res
        .clearCookie('admin_token', cookieOptions)
        .status(200)
        .json({
            success: true,
            message: 'Logged out successfully'
        });
});

export default router;