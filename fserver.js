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


// --- Database Connection ---
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  console.error("MongoDB URI not found. Please set the MONGODB_URI environment variable.");
  process.exit(1);
}

mongoose.connect(MONGODB_URI).then(() => console.log('MongoDB connected successfully')).catch(err => console.error('MongoDB connection error:', err));


//Schemas
//User Schema
const UserSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true, minlength: 6, select: false }
}, { timestamps: true });


//Password Hashing Bcrypt
UserSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();
  const salt = await bcrypt.genSalt(12);
  this.password = await bcrypt.hash(this.password, salt);
  next();
});


// Method to compare an entered password with the hashed password in the database
UserSchema.methods.matchPassword = async function (enteredPassword) {
  return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', UserSchema);


// --- Category Schema ---
const CategorySchema = new mongoose.Schema({
  name: { type: String, required: true, unique: true, trim: true },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  level: { type: Number, required: true, min: 0, default: 0 },
  imageUrl: { type: String, trim: true },
  description: { type: String, trim: true },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

//Slug Generation
CategorySchema.pre('save', async function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  if (this.parentId && this.isModified('parentId')) {
    const parentCategory = await this.model('Category').findById(this.parentId);
    if (parentCategory) {
      this.level = parentCategory.level + 1;
    } else {
      return next(new Error('Parent category not found.'));
    }
  } else if (!this.parentId && this.isModified('parentId')) {
    this.level = 0;
  } else if (this.isNew && !this.parentId) {
    this.level = 0;
  }

  next();
});

const Category = mongoose.model('Category', CategorySchema);

//Product Schema
const ProductSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true, maxlength: 200 },
  slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
  price: { type: Number, required: true, min: 0 },
  unit: { type: String, trim: true, enum: ['kg', 'liter', 'pack', 'piece', 'g', 'ml', 'unit', 'dozen', 'other'], required: true },
  sku: { type: String, unique: true, trim: true, sparse: true, maxlength: 50 },
  stock: { type: Number, required: true, min: 0, default: 0 },
  isAvailable: { type: Boolean, default: true },
  ratings: { type: Number, min: 0, max: 5, default: 0, set: v => Math.round(v * 10) / 10 },
  numReviews: { type: Number, min: 0, default: 0 },
  tags: { type: [String], default: [], set: v => Array.isArray(v) ? v.map(tag => tag.toLowerCase().trim()) : [] },
  attributes: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

//Slug Generation Product
ProductSchema.pre('save', function (next) {
  if (this.isModified('name') && !this.slug) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }
  next();
});

// Pre-save hook for ProductSchema to populate mainCategoryId based on categoryId
ProductSchema.pre('save', async function (next) {
  if (this.isModified('categoryId')) {
    const subCategory = await mongoose.model('Category').findById(this.categoryId);
    if (subCategory) {
      if (subCategory.parentId) {
        this.mainCategoryId = subCategory.parentId;
      } else {
        this.mainCategoryId = subCategory._id;
      }
    } else {
      return next(new Error('Referenced category not found for product.'));
    }
  }
  next();
});

const Product = mongoose.model('Product', ProductSchema);

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

// Middleware to authenticate routes by verifying JWT token
const authenticate = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ message: 'Authorization token missing or malformed', tokenValid: false });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    req.user = decoded;
    res.locals.tokenValid = true;
    next();
  } catch (error) {
    console.error('JWT Verification Error:', error.message);
    return res.status(401).json({ message: 'Unauthorized: Invalid or expired token', tokenValid: false });
  }
};

// --- API Routes ---

// Basic route for testing
app.get('/', (req, res) => {
  res.send('Hello from Grojet Server');
});


//User Login and Register Section
// Register New User
app.post('/auth/register', async (req, res) => {
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

// Login of User
app.post('/auth/login', async (req, res) => {
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


// Gets the authenticated user's profile Information
app.get('/auth/me', authenticate, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('name email createdAt');
    if (!user) return res.status(404).json({ msg: 'User not found' });

    res.status(200).json({ success: true, user });
  } catch (err) {
    console.error('Fetch user error:', err);
    res.status(500).json({ msg: 'Server error' });
  }
});


//Admin Section
// Creates a new category
app.post('/admin/categories', authenticate, async (req, res) => {
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
// Fetches a list of all product categories
app.get('/admin/categories', async (req, res) => {
  try {
    const categories = await Category.find({}).sort({ name: 1 });
    res.status(200).json({ success: true, categories });
  } catch (err) {
    console.error('Get categories error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gets a category by ID
// Fetches a single category by its unique identifier
app.get('/admin/categories/:id', async (req, res) => {
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
app.put('/admin/categories/:id', authenticate, async (req, res) => {
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
app.delete('/admin/categories/:id', authenticate, async (req, res) => {
  try {
    const deletedCategory = await Category.findByIdAndDelete(req.params.id);
    if (!deletedCategory) {
      return res.status(404).json({ message: 'Category not found' });
    }
    res.status(200).json({ success: true, message: 'Category deleted successfully' });
  }
  catch (err) {
    console.error('Delete category error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Creates a new product
app.post('/admin/products', authenticate, async (req, res) => {
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
// Requires authentication (authenticate middleware) to get the product count
app.get('/admin/products/count', authenticate, async (req, res) => {
  try {
    const count = await Product.countDocuments();
    res.status(200).json({ success: true, count });
  } catch (err) {
    console.error('Get product count error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gets all products with category details
// Fetches a list of all products, populating their associated category names and slugs
app.get('/admin/products', async (req, res) => {
  try {
    const products = await Product.find({})
      .populate('categoryId', 'name slug')
      .populate('mainCategoryId', 'name slug')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    res.status(200).json({ success: true, products });
  } catch (err) {
    console.error('Get all products error:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Gets a product by ID with category details
// Fetches a single product by its unique identifier, populating its category details
app.get('/admin/products/:id', async (req, res) => {
  try {
    const product = await Product.findById(req.params.id)
      .populate('categoryId', 'name slug')
      .populate('mainCategoryId', 'name slug');
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
app.put('/admin/products/:id', authenticate, async (req, res) => {
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

// Deletes a product by ID
app.delete('/admin/products/:id', authenticate, async (req, res) => {
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

// Logs in an admin user
// Provides a dedicated login endpoint for administrators
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


//Delivery Agent Section
// Logs in a delivery agent
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

//Public Merchant Section
// Registers a Merchant Enquiry
app.post('/merchants/enquiries', async (req, res) => {
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

// Gets all merchant enquiries to admin
app.get('/admin/merchants/enquiries', authenticate, async (req, res) => {
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

// Starts the Express server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
});
