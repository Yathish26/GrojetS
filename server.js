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
import networkHealth from './routes/tools/networkhealth.js'

const app = express();
const PORT = process.env.PORT || 5000;

// Connect to Database
connectDB();

// Middleware
app.use(cors({
  origin: [
    'https://grojetdelivery.com',
    'http://localhost:5173',
  ],
  credentials: true
}));
app.use(bodyParser.json());

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


//Network Health Check Route
app.use('/tools/network/health', networkHealth);

// Admin Routes
app.use('/admin/auth', authAdmin);
app.use('/admin/categories', categoryAdmin);
app.use('/admin/products', productAdmin);
app.use('/admin/merchants', merchantAdmin);
app.use('/admin/users', userAdmin);

// Delivery Routes
app.use('/delivery/auth', authDelivery);

// Public Routes
app.use('/auth', authRoutes);
app.use('/products', productAdmin);
app.use('/merchants', merchantRoutes);

// Start the Express server
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log(`Access: http://localhost:${PORT}`);
});