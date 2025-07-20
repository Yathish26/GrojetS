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
            expiresIn: '7d'
        });

        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token
        });
    } catch (err) {
        console.error('Admin login error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

export default router;