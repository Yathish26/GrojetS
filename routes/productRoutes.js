import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = express.Router();

// Get single product by ID
router.get('/product/:productId', async (req, res) => {
  try {
    const { productId } = req.params;
    
    // Get product with full details
    const product = await Product.findById(productId)
      .populate('category', 'name image description')
      .exec();
    
    if (!product) {
      return res.status(404).json({ error: 'Product not found' });
    }

    // Increment view count
    await Product.findByIdAndUpdate(productId, { $inc: { viewCount: 1 } });
    
    res.json({ product });
  } catch (err) {
    console.error('Error fetching product:', err);
    res.status(500).json({ error: 'Failed to fetch product details' });
  }
});

// Category Products
router.get('/:categoryId/products', async (req, res) => {
  try {
    const { categoryId } = req.params;
    const page = Number(req.query.page) || 1;
    const limit = Number(req.query.limit) || 20;
    const sortBy = req.query.sortBy || 'name'; // name, price, discount, rating
    const sortOrder = req.query.sortOrder === 'desc' ? -1 : 1;
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    
    // Build filter query
    const filter = { category: categoryId };
    
    // Add price filter if provided
    if (minPrice !== undefined || maxPrice !== undefined) {
      filter['pricing.sellingPrice'] = {};
      if (minPrice !== undefined) filter['pricing.sellingPrice'].$gte = minPrice;
      if (maxPrice !== undefined) filter['pricing.sellingPrice'].$lte = maxPrice;
    }
    
    // Build sort query
    let sortQuery = {};
    switch (sortBy) {
      case 'price':
        sortQuery = { 'pricing.sellingPrice': sortOrder };
        break;
      case 'discount':
        sortQuery = { 'pricing.discountPercent': sortOrder };
        break;
      case 'rating':
        sortQuery = { 'rating.average': sortOrder };
        break;
      default:
        sortQuery = { name: sortOrder };
    }
    
    const skip = (page - 1) * limit;
    
    // Get total count for pagination
    const totalProducts = await Product.countDocuments(filter);
    
    // Get products
    const products = await Product.find(filter)
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand rating.average rating.count')
      .sort(sortQuery)
      .skip(skip)
      .limit(limit)
      .exec();
    
    // Get category info
    const category = await Category.findById(categoryId)
      .select('name image description mainCategory')
      .exec();
    
    res.json({
      category,
      products,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalProducts / limit),
        totalProducts,
        hasNextPage: page < Math.ceil(totalProducts / limit),
        hasPrevPage: page > 1
      }
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category products' });
  }
});

export default router;