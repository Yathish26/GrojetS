import 'dotenv/config';
import express from 'express';
import bodyParser from 'body-parser';
import cors from 'cors';
import connectDB from './config/db.js';
import authRoutes from './routes/authRoutes.js';
import categoryAdmin from './routes/admin/categoryAdmin.js';
import productAdmin from './routes/admin/productAdmin.js';
import merchantRoutes from './routes/merchantRoutes.js';
import merchantAdmin from './routes/admin/merchantAdmin.js';
import authAdmin from './routes/admin/authAdmin.js';
import authDelivery from './routes/delivery/authDelivery.js';
import userAdmin from './routes/admin/userAdmin.js';
import deliveryAgentAdmin from './routes/admin/deliveryAgentAdmin.js';
import orderAdmin from './routes/admin/orderAdmin.js';
import deliveryZoneAdmin from './routes/admin/deliveryZoneAdmin.js';
import networkHealth from './routes/tools/networkhealth.js'
import cookieParser from 'cookie-parser';
import homepageRoutes from './routes/homepageRoutes.js';
import categoryRoutes from './routes/categoryRoutes.js';
import imageRoutes from './routes/tools/imageRoutes.js';
import adminManagement from './routes/admin/adminManagement.js';
import inventoryRoutes from './routes/inventoryRoutes.js';
import productRoutes from './routes/productRoutes.js';
import migrationRoutes from './routes/admin/migrationRoutes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: [
    'https://grojetdelivery.com',
    'https://admin.grojetdelivery.com',
    'http://localhost:5173',
    'http://localhost:5174',
    'http://localhost:3000',
    'http://192.168.1.38:5000', // Add your local IP if needed
    'exp://192.168.1.35:8081', // Expo development server
    'http://192.168.7.10:5000',
    true // Allow all origins for React Native development
  ],
  credentials: true,
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Platform']
}));
app.use(bodyParser.json({ limit: '10mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '10mb' }));
app.use(cookieParser());

// Basic Route
app.get('/', (req, res) => {
  res.send(`
    <h1>🚀 Welcome to the Grojet Server</h1>
    <p>Uh-oh... 👀 Looks like you've stumbled into the <strong>backend boiler room</strong>.</p>
    <p>This is where the code sweats, APIs scream, and JSON flies — not the place for groceries 🍅🥦</p>
    <p>But hey, if you're looking to get groceries delivered to your door in minutes (without messing with code)...</p>
    <h3>👉 Visit <a href="https://grojetdelivery.com" target="_blank">grojetdelivery.com</a> and let the magic happen!</h3>
    <p><em>Now go on, unless you're here to debug with us 😅</em></p>
  `);
});

// Health Check Route
app.use('/tools/network/health', networkHealth);

//Tools
app.use('/image', imageRoutes)

// Admin Routes
app.use('/admin/auth', authAdmin);
app.use('/admin/dashboard', adminManagement);
app.use('/admin/categories', categoryAdmin);
app.use('/admin/products', productAdmin);
app.use('/admin/merchants', merchantAdmin);
app.use('/admin/users', userAdmin);
app.use('/admin/delivery-agents', deliveryAgentAdmin);
app.use('/admin/orders', orderAdmin);
app.use('/admin/delivery-zones', deliveryZoneAdmin);
app.use('/admin/admin-management', adminManagement);
app.use('/admin/migrations', migrationRoutes);

// Delivery Routes
app.use('/delivery/auth', authDelivery);

// Inventory Routes
app.use('/inventory', inventoryRoutes);

// Public Routes
app.use('/auth', authRoutes);
app.use('/products', productRoutes);
app.use('/merchants', merchantRoutes);
app.use('/home', homepageRoutes);
app.use('/categories', categoryRoutes);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Something went wrong!',
    error: process.env.NODE_ENV === 'development' ? err.message : 'Internal server error'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({
    success: false,
    message: 'Route not found'
  });
});

// Start the Express server
app.listen(PORT, () => {
  console.log(`🚀 Grojet Server running on port ${PORT}`);
  console.log(`📱 Access: http://localhost:${PORT}`);
});