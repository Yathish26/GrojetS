import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { protectNative } from '../middleware/authMiddleware.js';

const router = express.Router();

// Registers a new user
router.post('/register', async (req, res) => {
    const { name, email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) {
            return res.status(400).json({ message: 'User already exists' });
        }
        user = new User({ name, email, password });
        await user.save();
        res.status(201).json({
            success: true,
            message: 'User registered successfully',
            user: { id: user._id, name: user.name, email: user.email }
        });
    } catch (err) {
        console.error(err.message);
        res.status(500).send('Server error');
    }
});

// Logs in a user and returns a JWT token
router.post('/login', async (req, res) => {
    try {
        const { email, password } = req.body;

        const user = await User.findOne({ email }).select('+password');
        if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

        const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
            expiresIn: '7d'
        });

        res.status(200).json({
            success: true,
            message: 'Logged in successfully',
            token,
            user: {
                id: user._id,
                name: user.name,
                email: user.email
            }
        });
    } catch (err) {
        console.error('Login error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

// Gets the authenticated user's profile
router.get('/me', protectNative, async (req, res) => {
    try {
        const user = await User.findById(req.user.userId).select('name email createdAt');
        if (!user) return res.status(404).json({ msg: 'User not found' });

        res.status(200).json({ success: true, user });
    } catch (err) {
        console.error('Fetch user error:', err);
        res.status(500).json({ msg: 'Server error' });
    }
});

export default router;