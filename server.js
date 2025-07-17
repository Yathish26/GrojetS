import 'dotenv/config';
import express from 'express';
import mongoose from 'mongoose';
import bodyParser from 'body-parser';
import cors from 'cors';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(bodyParser.json());

// --- User Model Definition ---
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6, select: false },
  createdAt: { type: Date, default: Date.now }
});


// Hash password before saving
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});

// Method to compare passwords
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);

// --- Inventory Model Definition ---
const InventorySchema = new mongoose.Schema({
  itemName: { type: String, required: true, trim: true },
  stockquantity: { type: Number, required: true, min: 0 },
  price: { type: Number, required: true, min: 0 },
  category: { type: String, required: true, trim: true },
  addedAt: { type: Date, default: Date.now }
});

const Inventory = mongoose.model('Inventory', InventorySchema);

// --- Merchant Model Definition ---
const MerchantSchema = new mongoose.Schema({
  businessName: { type: String, required: true, trim: true },
  contactPerson: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  phone: { type: String, required: true, trim: true },
  businessType: { type: String, required: true, trim: true },
  address: { type: String, required: true, trim: true },
  message: { type: String, trim: true },
  registrationDate: { type: Date, default: Date.now }
});

const Merchant = mongoose.model('Merchant', MerchantSchema);

// --- Database Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MongoDB URI not found. Please set the MONGODB_URI environment variable.");
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('MongoDB connected successfully'))
  .catch(err => console.error('MongoDB connection error:', err));


// Authorization
const protect = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer '))
    return res.status(401).json({ msg: 'No token provided' });

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Contains userId
    next();
  } catch (err) {
    console.error('Token error:', err);
    return res.status(401).json({ msg: 'Invalid or expired token' });
  }
};

// --- API Routes ---

// Register User
app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body;
  try {
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }
    user = new User({ name, email, password });
    await user.save();
    res.status(201).json({
      success: true,
      message: 'User registered successfully',
      user: { id: user._id, name: user.name, email: user.email }
    });
  } catch (err) {
    console.error(err.message);
    res.status(500).send('Server error');
  }
});

// Login User
app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    const user = await User.findOne({ email }).select('+password');
    if (!user) return res.status(400).json({ msg: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ msg: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Basic Route
app.get('/', (req, res) => {
  res.send('Hello from Grojet Server');
});

//User Profile
app.get('/api/auth/me', protect, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('name email createdAt');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Add Inventory Item
app.post('/inventory/add', protect, async (req, res) => {
  try {
    const { itemName, stockquantity, price, category } = req.body;
    const inventory = new Inventory({ itemName, stockquantity, price, category });
    await inventory.save();

    res.status(201).json({
      success: true,
      message: 'Inventory item added successfully',
      inventory: {
        id: inventory._id,
        itemName: inventory.itemName,
        stockquantity: inventory.stockquantity,
        price: inventory.price,
        category: inventory.category
      }
    });
  } catch (err) {
    console.error('Add inventory error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get Inventory Count
app.get('/inventory/count', protect, async (req, res) => {
  try {
    const count = await Inventory.countDocuments();
    res.status(200).json({ success: true, count });
  } catch (err) {
    console.error('Get inventory count error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Get All Inventory Items
app.get('/inventory/all', protect, async (req, res) => {
  try {
    const inventory = await Inventory.find({}, 'itemName category stockquantity price createdAt')
      .sort({ createdAt: -1 })
      .limit(100) // Only sends first 100
      .lean();

    res.status(200).json({ success: true, inventory });
  } catch (err) {
    console.error('Get all inventory error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


// Delete Inventory Item
app.delete('/inventory/delete/:id', protect, async (req, res) => {
  try {
    const { id } = req.params;

    const deletedItem = await Inventory.findByIdAndDelete(id);
    if (!deletedItem) {
      return res.status(404).json({ success: false, message: 'Inventory item not found' });
    }

    res.status(200).json({ success: true, message: 'Inventory item deleted successfully' });
  } catch (error) {
    console.error('Error deleting inventory item:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
});


// Edit Inventory Item
app.put('/inventory/edit/:id', protect, async (req, res) => {
  try {
    const inventory = await Inventory.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!inventory) return res.status(404).json({ msg: 'Inventory item not found' });

    res.status(200).json({ success: true, inventory });
  } catch (err) {
    console.error('Edit inventory error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Admin Login
app.post('/admin/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email !== 'admin@grojet.com' || password !== '123456') {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ admin: true }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token
    });
  } catch (err) {
    console.error('Admin login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});

// Delivery Agent Login
app.post('/delivery/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (email !== 'delivery@grojet.com' || password !== '123456') {
      return res.status(400).json({ msg: 'Invalid credentials' });
    }

    const token = jwt.sign({ agent: true }, process.env.JWT_SECRET, {
      expiresIn: '7d'
    });

    res.status(200).json({
      success: true,
      message: 'Logged in successfully',
      token
    });
  } catch (err) {
    console.error('Agent login error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


//Register Merchants
app.post('/merchants', async (req, res) => {
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
    console.error('Merchant creation error:', err);

    if (err.code === 11000) {
      return res.status(400).json({ error: 'A merchant with this email already exists.' });
    }

    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Get all Merchant Enquiries
app.get('/merchants/enquiries',protect, async (req, res) => {
  try {
    const merchants = await Merchant.find({}, 'businessName contactPerson email phone businessType address message createdAt')
      .sort({ createdAt: -1 })
      .lean();

    res.status(200).json({ success: true, merchants });
  } catch (err) {
    console.error('Get merchant enquiries error:', err);
    res.status(500).json({ error: 'Server error. Please try again later.' });
  }
});

// Start Server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
});
