import express from 'express';
import Category from '../../models/Category.js';
import { protect } from '../../middleware/authMiddleware.js';

const router = express.Router();

// Creates a new category
router.post('/', protect, async (req, res) => {
    try {
        const newCategory = new Category(req.body);
        const savedCategory = await newCategory.save();
        res.status(201).json({ success: true, category: savedCategory });
    } catch (err) {
        console.error('Create category error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Category name or slug already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Gets all categories
router.get('/', protect, async (req, res) => {
    try {
        const categories = await Category.find({}).sort({ name: 1 });
        res.status(200).json({ success: true, categories });
    } catch (err) {
        console.error('Get categories error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Gets a category by ID
router.get('/:id', protect, async (req, res) => {
    try {
        const category = await Category.findById(req.params.id);
        if (!category) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({ success: true, category });
    } catch (err) {
        console.error('Get category by ID error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

// Updates a category by ID
router.put('/:id', protect, async (req, res) => {
    try {
        const updatedCategory = await Category.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true });
        if (!updatedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({ success: true, category: updatedCategory });
    } catch (err) {
        console.error('Update category error:', err);
        if (err.code === 11000) {
            return res.status(400).json({ message: 'Category name or slug already exists.' });
        }
        res.status(500).json({ message: 'Server error' });
    }
});

// Deletes a category by ID
router.delete('/:id', protect, async (req, res) => {
    try {
        const deletedCategory = await Category.findByIdAndDelete(req.params.id);
        if (!deletedCategory) {
            return res.status(404).json({ message: 'Category not found' });
        }
        res.status(200).json({ success: true, message: 'Category deleted successfully' });
    } catch (err) {
        console.error('Delete category error:', err);
        res.status(500).json({ message: 'Server error' });
    }
});

export default router;