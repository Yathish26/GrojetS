import express from 'express';
import Product from '../../models/Product.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Creates a new product
router.post('/', protect, async (req, res) => {
    try {
        const newProduct = new Product(req.body);
        const savedProduct = await newProduct.save();
        res.status(201).json({ success: true, product: savedProduct });
    } catch (err) {
        console.error('Add product error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Product slug or SKU already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Gets the total count of all products
router.get('/count', protect, async (req, res) => {
    try {
        const count = await Product.countDocuments();
        res.status(200).json({ success: true, count });
    } catch (err) {
        console.error('Get product count error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Gets paginated products with category, status, and search filtering
router.get('/', async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 100;
        const search = req.query.search || '';
        const category = req.query.category || '';
        const status = req.query.status || '';

        const query = {};
        if (search) {
            query.$or = [
                { name: { $regex: search, $options: 'i' } },
                { slug: { $regex: search, $options: 'i' } },
                { sku: { $regex: search, $options: 'i' } }
            ];
        }
        if (category) {
            query.category = category;
        }
        if (status) {
            query.status = status;
        }

        const products = await Product.find(query)
            .populate('category', 'name slug')
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(limit)
            .lean();

        const total = await Product.countDocuments(query);

        res.status(200).json({
            success: true,
            products,
            page,
            totalPages: Math.ceil(total / limit),
            total
        });
    } catch (err) {
        console.error('Get all products error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Gets a product by ID with category details
router.get('/:id', async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('category', 'name slug')
            .populate('mainCategory', 'name slug');
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ success: true, product });
    } catch (err) {
        console.error('Get product by ID error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Updates a product by ID
router.put('/:id', protect, async (req, res) => {
    try {
        const updatedProduct = await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedProduct) {
            return res.status(404).json({ message: 'Product not found' });
        }
        res.status(200).json({ success: true, product: updatedProduct });
    } catch (err) {
        console.error('Edit product error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Product slug or SKU already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Update product status (availability)
router.put('/:id/status', protect, async (req, res) => {
    try {
        const { isAvailable } = req.body;
        
        const product = await Product.findByIdAndUpdate(
            req.params.id,
            { isAvailable },
            { new: true }
        );

        if (!product) {
            return res.status(404).json({ 
                success: false,
                message: 'Product not found' 
            });
        }

        res.status(200).json({
            success: true,
            message: `Product ${isAvailable ? 'enabled' : 'disabled'} successfully`,
            product
        });
    } catch (error) {
        console.error('Error updating product status:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error' 
        });
    }
});

// Deletes a product by ID
router.delete('/:id', protect, async (req, res) => {
    try {
        const deletedProduct = await Product.findByIdAndDelete(req.params.id);
        if (!deletedProduct) {
            return res.status(404).json({ success: false, message: 'Product not found' });
        }
        res.status(200).json({ success: true, message: 'Product deleted successfully' });
    } catch (error) {
        console.error('Error deleting product:', error);
        res.status(500).json({ success: false, message: 'Internal server error' });
    }
});

export default router;