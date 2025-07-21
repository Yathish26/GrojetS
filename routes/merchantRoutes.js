import express from 'express';
import Merchant from '../models/Merchant.js';

const router = express.Router();

// Registers a new merchant
router.post('/', async (req, res) => {
    const requiredFields = [
        'businessName',
        'contactPerson',
        'email',
        'phone',
        'businessType',
        'address'
    ];

    const missingFields = requiredFields.filter(field => !req.body[field]);
    if (missingFields.length) {
        return res.status(400).json({ error: `Missing fields: ${missingFields.join(', ')}` });
    }

    try {
        const {
            businessName,
            contactPerson,
            email,
            phone,
            businessType,
            address,
            message = ''
        } = req.body;

        const existingMerchant = await Merchant.findOne({ email });
        if (existingMerchant) {
            return res.status(400).json({ error: 'A merchant with this email already exists.', dupMerchant: true });
        }

        const newMerchant = new Merchant({
            businessName,
            contactPerson,
            email,
            phone,
            businessType,
            address,
            message
        });

        const savedMerchant = await newMerchant.save();
        res.status(201).json({ success: true, merchant: savedMerchant });
    } catch (err) {
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

export default router;