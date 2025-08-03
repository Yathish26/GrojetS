import express from 'express';
import Product from '../models/Product.js';
import Category from '../models/Category.js';

const router = express.Router();

// Featured Products
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

// Hot Deals
router.get('/hotdeals', async (req, res) => {
  try {
    const minDiscount = Number(req.query.minDiscount) || 5;
    const limit = 10;
    const hotDeals = await Product.find({ 'pricing.discountPercent': { $gte: minDiscount } })
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
      .sort({ 'pricing.discountPercent': -1 })
      .limit(limit)
      .exec();
    res.json(hotDeals);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch hot deals' });
  }
});

// New Arrivals
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

// Offers and Deals
router.get('/offers', async (req, res) => {
  try {
    const minDiscount = Number(req.query.minDiscount) || 1;
    const limit = 10;
    const offerProducts = await Product.find({ 'pricing.discountPercent': { $gte: minDiscount } })
      .select('name slug thumbnail pricing.mrp pricing.sellingPrice pricing.discountPercent pricing.offerTag stock.status category_string brand')
      .sort({ 'pricing.discountPercent': -1 })
      .limit(limit)
      .exec();
    res.json(offerProducts);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch offer products' });
  }
});

// Category and Quick Picks
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

// Category List Only and from and to
// /categories/list?from=5&to=8
router.get('/categories/list', async (req, res) => {
  try {
    const categoryLimit = Number(req.query.limit) || 20;
    const from = Number(req.query.from) || 0;
    const to = req.query.to !== undefined ? Number(req.query.to) : from + categoryLimit;

    // Ensure indices are valid and from <= to
    const start = Math.max(0, from);
    const end = Math.max(start, to);

    // Use skip and limit for efficient pagination
    const totalToGet = end - start;

    const categories = await Category.find({})
      .select('_id name image')
      .skip(start)
      .limit(totalToGet)
      .exec();

    res.json(categories);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch category list' });
  }
});

// Trending Products
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