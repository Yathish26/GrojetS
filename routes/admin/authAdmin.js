import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Logs in an admin user
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email !== 'admin@grojet.com' || password !== '123456') {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        res
            .cookie('admin_token', token, {
                httpOnly: true,
                secure: process.env.NODE_ENV === 'production', // only send over HTTPS in production
                maxAge: 24 * 60 * 60 * 1000, // 1 day
                sameSite: 'none',
                domain: '.grojetdelivery.com'
            })
            .status(200)
            .json({
                success: true,
                message: 'Logged in successfully'
            });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

router.post('/logout', (req, res) => {
    res
        .clearCookie('admin_token', {
            httpOnly: true,
            secure: process.env.NODE_ENV === 'production',
            sameSite: 'none',
            domain: '.grojetdelivery.com'
        })
        .status(200)
        .json({
            success: true,
            message: 'Logged out successfully'
        });
});

export default router;