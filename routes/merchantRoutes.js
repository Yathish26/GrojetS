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
        'region'
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
            alternatePhone = '',
            businessType,
            region,
            message = ''
        } = req.body;

        const existingMerchant = await Merchant.findOne({ email });
        const existingMobile = await Merchant.findOne({ phone });
        
        if (existingMerchant) {
            return res.status(400).json({ error: 'A merchant with this email already exists.', dupMerchant: true });
        }
        if (existingMobile) {
            return res.status(400).json({ error: 'A merchant with this phone number already exists.', dupPhone: true });
        }

        const newMerchant = new Merchant({
            businessName,
            contactPerson,
            email,
            phone,
            alternatePhone,
            businessType,
            region,
            message
        });

        const savedMerchant = await newMerchant.save();
        res.status(201).json({ success: true, merchant: savedMerchant });
    } catch (err) {
        res.status(500).json({ error: 'Server error. Please try again later.' });
    }
});

export default router;