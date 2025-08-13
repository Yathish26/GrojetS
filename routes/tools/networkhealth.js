import express from 'express';

const router = express.Router();

// Example route to check network health
router.get('/', (req, res) => {
    res.status(200).json({
        status: 'ok',
        message: 'Network health is good',
    });
});

export default router;