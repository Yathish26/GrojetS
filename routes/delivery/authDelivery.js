import express from 'express';
import jwt from 'jsonwebtoken';

const router = express.Router();

// Logs in a delivery agent
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;
        if (email !== 'delivery@grojet.com' || password !== '123456') {
            return res.status(400).json({ msg: 'Invalid credentials' });
        }

        const token = jwt.sign({ agent: true }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token
        });
    } catch (err) {
        console.error('Agent login error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

export default router;