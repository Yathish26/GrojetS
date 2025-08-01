import express from 'express';
import Admin from '../../models/Admin.js';
import User from '../../models/User.js';
import Merchant from '../../models/Merchant.js';
import DeliveryAgent from '../../models/DeliveryAgent.js';
import Order from '../../models/Order.js';
import { protectWithRole } from '../../middleware/authMiddleware.js';

const router = express.Router();

// GET dashboard statistics
router.get('/dashboard/stats', protectWithRole(['admin', 'super_admin']), async (req, res, next) => {
  try {
    console.log('Fetching dashboard stats...');
    
    // Get counts for all entities
    const [
      totalUsers,
      totalMerchants,
      totalDeliveryAgents,
      totalOrders,
      pendingOrders
    ] = await Promise.all([
      User.countDocuments(),
      Merchant.countDocuments(),
      DeliveryAgent.countDocuments(),
      Order.countDocuments(),
      Order.countDocuments({ 'status.current': 'pending' })
    ]);

    // Calculate total revenue from completed orders
    const revenueResult = await Order.aggregate([
      { $match: { 'status.current': 'delivered' } },
      { $group: { _id: null, total: { $sum: '$pricing.totalAmount' } } }
    ]);
    
    const totalRevenue = revenueResult.length > 0 ? revenueResult[0].total : 0;

    const stats = {
      totalUsers,
      totalMerchants,
      totalDeliveryAgents,
      totalOrders,
      pendingOrders,
      totalRevenue
    };

    console.log('Dashboard stats:', stats);

    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error('Dashboard stats error:', error);
    next(error);
  }
});

// GET all admins (super_admin only)
router.get('/', protectWithRole('super_admin'), async (req, res, next) => {
  try {
    const admins = await Admin.find().select('-password');
    res.json({
      success: true,
      admins,
    });
  } catch (error) {
    next(error);
  }
});

// CREATE admin (super_admin only)
router.post('/', protectWithRole('super_admin'), async (req, res, next) => {
  try {
    const {
      name,
      email,
      password,
      role,
      permissions = [],
      phone,
      address,
      avatar,
    } = req.body;

    // Check if admin already exists
    const existing = await Admin.findOne({ email });
    if (existing) {
      return res.status(400).json({ message: 'Admin with this email already exists' });
    }

    const admin = new Admin({
      name,
      email,
      password,
      role,
      permissions,
      phone,
      address,
      avatar,
      createdBy: req.user._id,
    });

    await admin.save();

    res.status(201).json({ success: true, admin: {
      ...admin.toObject(),
      password: undefined // Don't send back password
    }});
  } catch (error) {
    next(error);
  }
});

// UPDATE admin (super_admin only)
router.put('/:id', protectWithRole('super_admin'), async (req, res, next) => {
  try {
    const updates = { ...req.body };
    // Prevent updating password directly through this route
    delete updates.password;

    // Don't allow email to be set to an existing admin's email
    if (updates.email) {
      const existing = await Admin.findOne({ email: updates.email, _id: { $ne: req.params.id } });
      if (existing) {
        return res.status(400).json({ message: 'Email already in use by another admin' });
      }
    }

    const admin = await Admin.findByIdAndUpdate(
      req.params.id, 
      updates, 
      { new: true, runValidators: true, context: 'query' }
    ).select('-password');
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({ success: true, admin });
  } catch (error) {
    next(error);
  }
});

// DELETE admin (super_admin only)
router.delete('/:id', protectWithRole('super_admin'), async (req, res, next) => {
  try {
    const admin = await Admin.findByIdAndDelete(req.params.id);
    if (!admin) {
      return res.status(404).json({ message: 'Admin not found' });
    }
    res.json({ success: true });
  } catch (error) {
    next(error);
  }
});

export default router;