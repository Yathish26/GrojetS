import express from 'express';
import Merchant from '../models/Merchant.js';

const router = express.Router();

// Registers a new merchant
router.post('/', async (req, res) => {
    try {
        const {
            businessName,
            contactPerson,
            email,
            phone,
            businessType,
            address,
            message,
        } = req.body;

        if (!businessName || !contactPerson || !email || !phone || !businessType || !address) {
            return res.status(400).json({ error: 'Please fill all required fields.' });
        }

        const newMerchant = new Merchant({
            businessName,
            contactPerson,
            email,
            phone,
            businessType,
            address,
            message,
        });

        const savedMerchant = await newMerchant.save();
        res.status(201).json({ success: true, merchant: savedMerchant });
    } catch (err) {

        if (err.code === 11000) {
            return res.status(400).json({ error: 'A merchant with this email already exists.', dupMerchant: true });
        }

        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

export default router;