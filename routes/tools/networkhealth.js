import express from 'express';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Example route to check network health
router.get('/', protect, (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Network health is good',
    });
});

export default router;