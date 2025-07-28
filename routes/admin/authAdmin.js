import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

const isProduction = process.env.NODE_ENV === 'production';

router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email !== 'admin@grojet.com' || password !== '123456') {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
            expiresIn: '1d'
        });

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction, // HTTPS only in production
            maxAge: 24 * 60 * 60 * 1000, // 1 day
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
                message: 'Logged in successfully'
            });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ msg: 'Server error' });
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