import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = express.Router();

/**
 * 1. Featured / Popular Items
 * GET /featured
 */
router.get('/featured', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 8;
    const featuredProducts = await Product.find({ isFeatured: true })
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
      .limit(limit)
      .exec();
    res.json(featuredProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch featured products' });
  }
});

/**
 * 2. New Arrivals
 * GET /new?limit=10
 */
router.get('/new', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 10;
    const newProducts = await Product.find({})
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
      .sort({ createdAt: -1 })
      .limit(limit)
      .exec();
    res.json(newProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch new arrivals' });
  }
});

/**
 * 3. Deals / Offers / Discounts
 * GET /offers?minDiscount=10
 */
router.get('/offers', async (req, res) => {
  try {
    const minDiscount = Number(req.query.minDiscount) || 1;
    const offerProducts = await Product.find({ 'pricing.discountPercent': { $gte: minDiscount } })
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
      .sort({ 'pricing.discountPercent': -1 })
      .exec();
    res.json(offerProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offer products' });
  }
});

/**
 * 4. Shop by Category (Quick Picks)
 * GET /categories/quick-picks?limit=6&productsPerCategory=3
 */
router.get('/categories/quick-picks', async (req, res) => {
  try {
    const categoryLimit = Number(req.query.limit) || 6;
    const productsPerCategory = Number(req.query.productsPerCategory) || 3;

    const categories = await Category.find({})
      .limit(categoryLimit)
      .exec();

    // Attach a few sample products to each category
    const categoriesWithProducts = await Promise.all(
      categories.map(async (cat) => {
        const sampleProducts = await Product.find({ category: cat._id })
          .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
          .limit(productsPerCategory)
          .exec();
        return {
          ...cat.toObject(),
          sampleProducts,
        };
      })
    );

    res.json(categoriesWithProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch categories' });
  }
});

/**
 * 5. Most Viewed / Trending Products
 * GET /trending?limit=6
 */
router.get('/trending', async (req, res) => {
  try {
    const limit = Number(req.query.limit) || 6;
    // Sort by either viewCount or soldCount (customize as needed)
    const trendingProducts = await Product.find({})
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand viewCount soldCount')
      .sort({ viewCount: -1, soldCount: -1 })
      .limit(limit)
      .exec();
    res.json(trendingProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch trending products' });
  }
});

export default router;