import express from 'express';
import jwt from 'jsonwebtoken';
import DeliveryAgent from '../../models/DeliveryAgent.js';
import Order from '../../models/Order.js';
import { protectDelivery } from '../../middleware/authMiddleware.js';

const router = express.Router();
const isProduction = process.env.NODE_ENV === 'production';

// Test route to create a sample delivery agent for testing
router.post('/create-test-agent', async (req, res) => {
    try {
        // Check if test agent already exists
        const existingAgent = await DeliveryAgent.findOne({ 'personalInfo.email': 'test@grojet.com' });
        
        if (existingAgent) {
            return res.json({ 
                success: true, 
                message: 'Test agent already exists',
                agent: {
                    email: existingAgent.personalInfo.email,
                    status: existingAgent.status.applicationStatus
                }
            });
        }

        const testAgent = new DeliveryAgent({
            personalInfo: {
                firstName: 'Test',
                lastName: 'Agent',
                email: 'test@grojet.com',
                phone: '9999999999',
                dateOfBirth: new Date('1990-01-01'),
                gender: 'male'
            },
            address: {
                street: 'Test Street',
                city: 'Test City',
                state: 'Test State',
                zipCode: '123456'
            },
            documents: {
                aadharFront: 'test-aadhar-front.jpg',
                aadharBack: 'test-aadhar-back.jpg',
                panCard: 'test-pan.jpg',
                bankAccount: {
                    accountNumber: '1234567890',
                    ifscCode: 'TEST0001',
                    bankName: 'Test Bank',
                    accountHolderName: 'Test Agent'
                }
            },
            vehicleInfo: {
                vehicleType: 'bike',
                vehicleNumber: 'TS01AB1234',
                rcBook: 'test-rc.jpg',
                insurance: 'test-insurance.jpg'
            },
            workInfo: {
                preferredAreas: ['Test Area'],
                availabilityHours: {
                    start: '09:00',
                    end: '22:00'
                },
                workingDays: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday']
            },
            authentication: {
                password: 'password123',
                isEmailVerified: true,
                isPhoneVerified: true
            },
            status: {
                applicationStatus: 'approved',
                isActive: true,
                isOnline: false, // Start offline by default
                deliveryZone: 'Test Zone',
                rating: 4.8,
                totalDeliveries: 127,
                completedDeliveries: 124,
                earnings: {
                    total: 15750.50,
                    thisMonth: 3250.75,
                    lastPayout: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) // 7 days ago
                }
            },
            verification: {
                documentsVerified: true,
                backgroundCheckPassed: true,
                trainingCompleted: true
            },
            emergencyContact: {
                name: 'Test Emergency Contact',
                relationship: 'Father',
                phone: '9888888888'
            }
        });

        await testAgent.save();
        
        res.json({
            success: true,
            message: 'Test delivery agent created successfully',
            agent: {
                email: testAgent.personalInfo.email,
                status: testAgent.status.applicationStatus
            }
        });
    } catch (error) {
        console.error('Create test agent error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test agent',
            error: error.message
        });
    }
});

// Test route to create sample orders for testing
router.post('/create-test-orders', async (req, res) => {
    try {
        const testOrders = [
            {
                customer: {
                    name: 'John Doe',
                    phone: '9876543210',
                    email: 'john@example.com',
                    address: {
                        street: '123 Main Street, Apartment 4B',
                        landmark: 'Near City Mall',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500032',
                        coordinates: {
                            latitude: 17.4065,
                            longitude: 78.4772
                        },
                        addressType: 'home'
                    }
                },
                restaurant: {
                    name: 'Spice Garden Restaurant',
                    phone: '9123456789',
                    address: {
                        street: '456 Restaurant Road',
                        landmark: 'Opposite Park',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500033',
                        coordinates: {
                            latitude: 17.4052,
                            longitude: 78.4775
                        }
                    }
                },
                items: [
                    {
                        name: 'Chicken Biryani',
                        quantity: 2,
                        price: 250,
                        image: 'biryani.jpg',
                        category: 'Main Course'
                    },
                    {
                        name: 'Raita',
                        quantity: 1,
                        price: 50,
                        image: 'raita.jpg',
                        category: 'Sides'
                    }
                ],
                pricing: {
                    itemsTotal: 550,
                    discount: 50,
                    deliveryFee: 40,
                    platformFee: 5,
                    tip: 20,
                    taxes: 33,
                    totalAmount: 598
                },
                deliveryInfo: {
                    estimatedTime: 35,
                    distance: 2.5,
                    deliveryInstructions: 'Ring the bell twice',
                    priority: 'normal'
                },
                payment: {
                    method: 'cash',
                    status: 'pending'
                }
            },
            {
                customer: {
                    name: 'Sarah Smith',
                    phone: '9876543211',
                    email: 'sarah@example.com',
                    address: {
                        street: '789 Garden Street, Floor 2',
                        landmark: 'Behind School',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500034',
                        coordinates: {
                            latitude: 17.4070,
                            longitude: 78.4780
                        },
                        addressType: 'office'
                    }
                },
                restaurant: {
                    name: 'Pizza Corner',
                    phone: '9123456788',
                    address: {
                        street: '321 Food Street',
                        landmark: 'Near Metro Station',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500035',
                        coordinates: {
                            latitude: 17.4058,
                            longitude: 78.4782
                        }
                    }
                },
                items: [
                    {
                        name: 'Margherita Pizza',
                        quantity: 1,
                        price: 350,
                        image: 'pizza.jpg',
                        category: 'Pizza'
                    },
                    {
                        name: 'Garlic Bread',
                        quantity: 1,
                        price: 120,
                        image: 'garlic_bread.jpg',
                        category: 'Sides'
                    }
                ],
                pricing: {
                    itemsTotal: 470,
                    discount: 0,
                    deliveryFee: 35,
                    platformFee: 5,
                    tip: 25,
                    taxes: 28,
                    totalAmount: 563
                },
                deliveryInfo: {
                    estimatedTime: 25,
                    distance: 1.8,
                    deliveryInstructions: 'Call before delivery',
                    priority: 'high'
                },
                payment: {
                    method: 'upi',
                    status: 'paid'
                }
            },
            {
                customer: {
                    name: 'Mike Johnson',
                    phone: '9876543212',
                    email: 'mike@example.com',
                    address: {
                        street: '555 Tech Park Road',
                        landmark: 'IT Building B',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500081',
                        coordinates: {
                            latitude: 17.4480,
                            longitude: 78.3915
                        },
                        addressType: 'office'
                    }
                },
                restaurant: {
                    name: 'Healthy Bites',
                    phone: '9123456787',
                    address: {
                        street: '100 Health Street',
                        landmark: 'Wellness Center',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500082',
                        coordinates: {
                            latitude: 17.4485,
                            longitude: 78.3920
                        }
                    }
                },
                items: [
                    {
                        name: 'Grilled Chicken Salad',
                        quantity: 1,
                        price: 280,
                        image: 'salad.jpg',
                        category: 'Healthy'
                    },
                    {
                        name: 'Fresh Juice',
                        quantity: 1,
                        price: 80,
                        image: 'juice.jpg',
                        category: 'Beverages'
                    }
                ],
                pricing: {
                    itemsTotal: 360,
                    discount: 30,
                    deliveryFee: 45,
                    platformFee: 5,
                    tip: 0,
                    taxes: 22,
                    totalAmount: 402
                },
                deliveryInfo: {
                    estimatedTime: 40,
                    distance: 4.2,
                    deliveryInstructions: 'Leave at reception',
                    priority: 'normal'
                },
                payment: {
                    method: 'card',
                    status: 'paid'
                }
            }
        ];

        const createdOrders = [];
        
        for (const orderData of testOrders) {
            const order = new Order(orderData);
            order.calculateAgentEarnings(); // Calculate earnings
            await order.save();
            createdOrders.push(order);
        }

        res.json({
            success: true,
            message: `${createdOrders.length} test orders created successfully`,
            orders: createdOrders.map(order => ({
                id: order._id,
                orderNumber: order.orderNumber,
                customer: order.customer.name,
                restaurant: order.restaurant.name,
                total: order.pricing.totalAmount,
                status: order.status.current
            }))
        });
    } catch (error) {
        console.error('Create test orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create test orders',
            error: error.message
        });
    }
});

// Test route to create delivered orders for today (for testing real data)
router.post('/create-today-delivered-orders', protectDelivery, async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        // Create orders that were delivered today
        const today = new Date();
        const todayOrders = [
            {
                customer: {
                    name: 'Today Customer 1',
                    phone: '9876543220',
                    email: 'customer1@example.com',
                    address: {
                        street: '100 Today Street',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500001',
                        coordinates: { latitude: 17.4065, longitude: 78.4772 }
                    }
                },
                restaurant: {
                    name: 'Today Restaurant',
                    phone: '9123456780',
                    address: {
                        street: '200 Restaurant St',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500002',
                        coordinates: { latitude: 17.4052, longitude: 78.4775 }
                    }
                },
                items: [{
                    name: 'Special Meal',
                    quantity: 1,
                    price: 200
                }],
                pricing: {
                    itemsTotal: 200,
                    deliveryFee: 30,
                    totalAmount: 230
                },
                deliveryInfo: {
                    estimatedTime: 30,
                    distance: 2.0
                },
                payment: { method: 'cash', status: 'paid' },
                status: { current: 'delivered' },
                assignment: {
                    deliveryAgent: req.deliveryAgent.agentId,
                    assignedAt: new Date(today.getTime() - 2 * 60 * 60 * 1000), // 2 hours ago
                    acceptedAt: new Date(today.getTime() - 2 * 60 * 60 * 1000),
                    deliveredAt: new Date(today.getTime() - 1 * 60 * 60 * 1000) // 1 hour ago
                },
                earnings: {
                    deliveryFee: 22.5, // 75% of delivery fee
                    tip: 20,
                    total: 42.5
                }
            },
            {
                customer: {
                    name: 'Today Customer 2',
                    phone: '9876543221',
                    email: 'customer2@example.com',
                    address: {
                        street: '101 Today Street',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500003',
                        coordinates: { latitude: 17.4070, longitude: 78.4780 }
                    }
                },
                restaurant: {
                    name: 'Today Restaurant 2',
                    phone: '9123456781',
                    address: {
                        street: '201 Restaurant St',
                        city: 'Hyderabad',
                        state: 'Telangana',
                        zipCode: '500004',
                        coordinates: { latitude: 17.4058, longitude: 78.4782 }
                    }
                },
                items: [{
                    name: 'Lunch Special',
                    quantity: 2,
                    price: 150
                }],
                pricing: {
                    itemsTotal: 300,
                    deliveryFee: 40,
                    totalAmount: 340
                },
                deliveryInfo: {
                    estimatedTime: 25,
                    distance: 3.5
                },
                payment: { method: 'upi', status: 'paid' },
                status: { current: 'delivered' },
                assignment: {
                    deliveryAgent: req.deliveryAgent.agentId,
                    assignedAt: new Date(today.getTime() - 3 * 60 * 60 * 1000), // 3 hours ago
                    acceptedAt: new Date(today.getTime() - 3 * 60 * 60 * 1000),
                    deliveredAt: new Date(today.getTime() - 30 * 60 * 1000) // 30 minutes ago
                },
                earnings: {
                    deliveryFee: 30, // 75% of delivery fee
                    tip: 15,
                    distanceBonus: 2.5, // Extra distance bonus
                    total: 47.5
                }
            }
        ];

        const createdOrders = [];
        
        for (const orderData of todayOrders) {
            const order = new Order(orderData);
            await order.save();
            createdOrders.push(order);
        }

        // Update agent's earnings and delivery count
        const totalTodayEarnings = createdOrders.reduce((sum, order) => sum + order.earnings.total, 0);
        
        agent.status.earnings.total += totalTodayEarnings;
        agent.status.earnings.thisMonth += totalTodayEarnings;
        agent.status.totalDeliveries += createdOrders.length;
        agent.status.completedDeliveries += createdOrders.length;
        
        await agent.save();

        res.json({
            success: true,
            message: `${createdOrders.length} delivered orders created for today`,
            orders: createdOrders.map(order => ({
                id: order._id,
                orderNumber: order.orderNumber,
                customer: order.customer.name,
                restaurant: order.restaurant.name,
                earnings: order.earnings.total,
                deliveredAt: order.assignment.deliveredAt
            })),
            totalEarningsAdded: totalTodayEarnings
        });
    } catch (error) {
        console.error('Create today delivered orders error:', error);
        res.status(500).json({
            success: false,
            message: 'Failed to create today delivered orders',
            error: error.message
        });
    }
});


// Delivery agent login
router.post('/login', async (req, res) => {
    try {
        console.log('Login request received:', req.body);
        const { email, password } = req.body;
        
        if (!email || !password) {
            console.log('Missing email or password');
            return res.status(400).json({ success: false, message: 'Email and password are required' });
        }
        
        console.log('Looking for agent with email:', email);
        // Find agent and include password field
        const agent = await DeliveryAgent.findOne({ 'personalInfo.email': email })
            .select('+authentication.password');
        
        if (!agent) {
            console.log('Agent not found');
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('Agent found, checking status...');
        // Check if application is approved
        if (agent.status.applicationStatus !== 'approved') {
            console.log('Agent not approved:', agent.status.applicationStatus);
            return res.status(400).json({ 
                success: false, 
                message: `Application is ${agent.status.applicationStatus}. Please contact support.` 
            });
        }

        // Check if agent is active
        if (!agent.status.isActive) {
            console.log('Agent is not active');
            return res.status(400).json({ 
                success: false, 
                message: 'Account is suspended. Contact admin.' 
            });
        }

        console.log('Verifying password...');
        // Verify password
        const isMatch = await agent.matchPassword(password);
        console.log('Password match result:', isMatch);
        
        if (!isMatch) {
            console.log('Password verification failed');
            return res.status(400).json({ success: false, message: 'Invalid credentials' });
        }

        console.log('Password verified, updating last login...');
        // Update last login but keep agent offline by default
        agent.authentication.lastLogin = new Date();
        // Don't automatically set online - let user choose
        // agent.status.isOnline = false; // Keep current status or default to false
        await agent.save();

        const token = jwt.sign(
            { 
                agentId: agent._id,
                email: agent.personalInfo.email,
                zone: agent.status.deliveryZone
            }, 
            process.env.JWT_SECRET, 
            { expiresIn: '12h' }
        );

        // Check if request is from React Native (mobile app)
        const userAgent = req.headers['user-agent'] || '';
        const isReactNative = userAgent.toLowerCase().includes('expo') || 
                             req.headers['x-platform'] === 'react-native' ||
                             req.body.platform === 'react-native';

        const agentData = {
            id: agent._id,
            name: `${agent.personalInfo.firstName} ${agent.personalInfo.lastName}`,
            email: agent.personalInfo.email,
            phone: agent.personalInfo.phone,
            zone: agent.status.deliveryZone,
            rating: agent.status.rating,
            totalDeliveries: agent.status.totalDeliveries,
            earnings: agent.status.earnings
        };

        if (isReactNative) {
            console.log('Sending React Native response with token');
            // For React Native, return token in response body
            const response = {
                success: true,
                message: 'Logged in successfully',
                token,
                agent: agentData
            };
            console.log('Response data:', response);
            res.status(200).json(response);
        } else {
            console.log('Sending web response with cookies');
            // For web, use cookies
            const cookieOptions = {
                httpOnly: true,
                secure: isProduction,
                maxAge: 12 * 60 * 60 * 1000, // 12 hours
                sameSite: isProduction ? 'none' : 'lax',
            };

            if (isProduction) {
                cookieOptions.domain = '.grojetdelivery.com';
            }

            res
                .cookie('delivery_token', token, cookieOptions)
                .status(200)
                .json({
                    success: true,
                    message: 'Logged in successfully',
                    agent: agentData
                });
        }
    } catch (err) {
        console.error('Delivery agent login error:', err);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update agent online status
router.put('/status/online', protectDelivery, async (req, res) => {
    try {
        const { isOnline } = req.body;
        
        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.deliveryAgent.agentId,
            { 'status.isOnline': isOnline },
            { new: true }
        ).select('-authentication.password');

        res.json({
            success: true,
            message: `Status updated to ${isOnline ? 'online' : 'offline'}`,
            agent
        });
    } catch (error) {
        console.error('Update online status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update agent location
router.put('/location', protectDelivery, async (req, res) => {
    try {
        const { latitude, longitude } = req.body;
        
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        await agent.updateLocation(latitude, longitude);

        res.json({
            success: true,
            message: 'Location updated successfully'
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Logout
router.post('/logout', protectDelivery, async (req, res) => {
    try {
        console.log('Logout request for agent ID:', req.deliveryAgent.agentId);
        
        // Set agent offline and update last logout time
        const agent = await DeliveryAgent.findByIdAndUpdate(
            req.deliveryAgent.agentId,
            { 
                'status.isOnline': false,
                'authentication.lastLogout': new Date()
            },
            { new: true }
        );

        if (agent) {
            console.log('Agent status updated to offline:', agent.personalInfo.firstName, agent.personalInfo.lastName);
        }

        const cookieOptions = {
            httpOnly: true,
            secure: isProduction,
            sameSite: isProduction ? 'none' : 'lax',
        };
        
        if (isProduction) {
            cookieOptions.domain = '.grojetdelivery.com';
        }

        res
            .clearCookie('delivery_token', cookieOptions)
            .status(200)
            .json({
                success: true,
                message: 'Logged out successfully. You are now offline.'
            });
    } catch (error) {
        console.error('Logout error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get delivery agent profile and dashboard data
router.get('/profile', protectDelivery, async (req, res) => {
    try {
        console.log('Profile request for agent ID:', req.deliveryAgent.agentId);
        
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId).select('-authentication.password');
        
        if (!agent) {
            console.log('Agent not found for ID:', req.deliveryAgent.agentId);
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        console.log('Agent found:', agent.personalInfo.firstName, agent.personalInfo.lastName);

        // Calculate today's actual deliveries and earnings
        const today = new Date();
        const startOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate());
        const endOfDay = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1);
        
        console.log('Calculating today\'s data from:', startOfDay, 'to:', endOfDay);
        
        // Get today's delivered orders for this agent
        const todayOrders = await Order.find({
            'assignment.deliveryAgent': req.deliveryAgent.agentId,
            'status.current': 'delivered',
            'assignment.deliveredAt': {
                $gte: startOfDay,
                $lt: endOfDay
            }
        });

        console.log('Found', todayOrders.length, 'orders delivered today');

        // Calculate today's earnings
        const todayEarnings = todayOrders.reduce((total, order) => {
            return total + (order.earnings?.total || 0);
        }, 0);

        console.log('Today\'s earnings calculated:', todayEarnings);

        const profileData = {
            success: true,
            agent: {
                id: agent._id,
                name: agent.fullName || `${agent.personalInfo.firstName} ${agent.personalInfo.lastName}`,
                email: agent.personalInfo.email,
                phone: agent.personalInfo.phone,
                profilePhoto: agent.personalInfo.profilePhoto || null,
                status: {
                    isOnline: agent.status.isOnline || false,
                    isActive: agent.status.isActive || false,
                    applicationStatus: agent.status.applicationStatus || 'pending',
                    rating: agent.status.rating || 5.0,
                    deliveryZone: agent.status.deliveryZone || 'Unassigned'
                },
                stats: {
                    totalDeliveries: agent.status.totalDeliveries || 0,
                    completedDeliveries: agent.status.completedDeliveries || 0,
                    todayDeliveries: todayOrders.length, // Real data
                    earnings: {
                        total: agent.status.earnings?.total || 0,
                        thisMonth: agent.status.earnings?.thisMonth || 0,
                        today: todayEarnings.toFixed(2), // Real today's earnings
                        lastPayout: agent.status.earnings?.lastPayout || null
                    }
                },
                location: agent.status.currentLocation || null
            }
        };

        console.log('Sending profile data with real today\'s stats:', {
            todayDeliveries: todayOrders.length,
            todayEarnings: todayEarnings.toFixed(2)
        });
        res.json(profileData);
    } catch (error) {
        console.error('Get profile error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Toggle online/offline status
router.post('/status/toggle', protectDelivery, async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        // Check if agent is approved
        if (agent.status.applicationStatus !== 'approved') {
            return res.status(403).json({ 
                success: false, 
                message: 'Cannot go online. Your application is not approved yet.' 
            });
        }

        // Toggle status
        const newStatus = !agent.status.isOnline;
        agent.status.isOnline = newStatus;
        
        // Update last updated time for location if going online
        if (newStatus && agent.status.currentLocation) {
            agent.status.currentLocation.lastUpdated = new Date();
        }

        await agent.save();

        res.json({
            success: true,
            message: `Status updated to ${newStatus ? 'online' : 'offline'}`,
            isOnline: newStatus
        });
    } catch (error) {
        console.error('Toggle status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update earnings (for testing purposes)
router.post('/earnings/update', protectDelivery, async (req, res) => {
    try {
        const { amount, type = 'delivery' } = req.body;
        
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        
        if (!agent) {
            return res.status(404).json({ success: false, message: 'Agent not found' });
        }

        // Update earnings
        agent.status.earnings.total += parseFloat(amount) || 0;
        agent.status.earnings.thisMonth += parseFloat(amount) || 0;
        
        // Increment delivery count
        if (type === 'delivery') {
            agent.status.totalDeliveries += 1;
            agent.status.completedDeliveries += 1;
        }

        await agent.save();

        res.json({
            success: true,
            message: 'Earnings updated successfully',
            earnings: agent.status.earnings
        });
    } catch (error) {
        console.error('Update earnings error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// ============== ORDER MANAGEMENT ROUTES ==============

// Get available orders for agent
router.get('/orders/available', protectDelivery, async (req, res) => {
    try {
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        
        if (!agent || !agent.status.isOnline) {
            return res.json({
                success: true,
                orders: [],
                message: 'Agent is offline'
            });
        }

        // Get available orders near agent's location
        const availableOrders = await Order.findAvailableOrders(agent.status.currentLocation);
        
        // Calculate earnings for each order
        const ordersWithEarnings = availableOrders.map(order => {
            const earnings = order.calculateAgentEarnings();
            return {
                id: order._id,
                orderNumber: order.orderNumber,
                customer: order.customer,
                restaurant: order.restaurant,
                items: order.items,
                totalAmount: order.pricing.totalAmount,
                deliveryInfo: order.deliveryInfo,
                earnings: earnings,
                orderAge: order.orderAge,
                priority: order.deliveryInfo.priority,
                distance: order.deliveryInfo.distance
            };
        });

        res.json({
            success: true,
            orders: ordersWithEarnings
        });
    } catch (error) {
        console.error('Get available orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Accept an order
router.post('/orders/:orderId/accept', protectDelivery, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { location } = req.body;
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.assignment.deliveryAgent && order.assignment.deliveryAgent.toString() !== req.deliveryAgent.agentId) {
            return res.status(400).json({ success: false, message: 'Order already assigned to another agent' });
        }

        if (order.status.current !== 'pending' && order.status.current !== 'confirmed') {
            return res.status(400).json({ success: false, message: 'Order cannot be accepted in current status' });
        }

        // Assign agent if not already assigned
        if (!order.assignment.deliveryAgent) {
            await order.assignAgent(req.deliveryAgent.agentId);
        }

        // Accept the order
        await order.acceptByAgent(req.deliveryAgent.agentId, location);

        // Calculate and update agent earnings
        const earnings = order.calculateAgentEarnings();
        
        res.json({
            success: true,
            message: 'Order accepted successfully',
            order: order.getDeliverySummary(),
            earnings: earnings
        });
    } catch (error) {
        console.error('Accept order error:', error);
        res.status(500).json({ success: false, message: 'Server error', error: error.message });
    }
});

// Reject an order
router.post('/orders/:orderId/reject', protectDelivery, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { reason = 'No reason provided' } = req.body;
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.assignment.deliveryAgent && order.assignment.deliveryAgent.toString() !== req.deliveryAgent.agentId) {
            return res.status(400).json({ success: false, message: 'You are not assigned to this order' });
        }

        await order.rejectByAgent(req.deliveryAgent.agentId, reason);

        res.json({
            success: true,
            message: 'Order rejected successfully'
        });
    } catch (error) {
        console.error('Reject order error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get agent's active orders
router.get('/orders/active', protectDelivery, async (req, res) => {
    try {
        const activeOrders = await Order.getAgentActiveOrders(req.deliveryAgent.agentId);
        
        const ordersWithDetails = activeOrders.map(order => order.getDeliverySummary());

        res.json({
            success: true,
            orders: ordersWithDetails
        });
    } catch (error) {
        console.error('Get active orders error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update order status
router.put('/orders/:orderId/status', protectDelivery, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status, location, notes = '' } = req.body;
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.assignment.deliveryAgent.toString() !== req.deliveryAgent.agentId) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this order' });
        }

        await order.updateStatus(status, location, notes, 'delivery_agent');

        // If order is delivered, update agent earnings
        if (status === 'delivered') {
            const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
            const earnings = order.calculateAgentEarnings();
            
            agent.status.earnings.total += earnings.total;
            agent.status.earnings.thisMonth += earnings.total;
            agent.status.totalDeliveries += 1;
            agent.status.completedDeliveries += 1;
            
            await agent.save();
        }

        res.json({
            success: true,
            message: `Order status updated to ${status}`,
            order: order.getDeliverySummary()
        });
    } catch (error) {
        console.error('Update order status error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get order details
router.get('/orders/:orderId', protectDelivery, async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.assignment.deliveryAgent.toString() !== req.deliveryAgent.agentId) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this order' });
        }

        res.json({
            success: true,
            order: order.getDeliverySummary()
        });
    } catch (error) {
        console.error('Get order details error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get order history
router.get('/orders/history', protectDelivery, async (req, res) => {
    try {
        const { page = 1, limit = 20 } = req.query;
        
        const orderHistory = await Order.getAgentOrderHistory(req.deliveryAgent.agentId, parseInt(limit));
        
        const historyWithDetails = orderHistory.map(order => ({
            id: order._id,
            orderNumber: order.orderNumber,
            customer: order.customer,
            restaurant: order.restaurant,
            totalAmount: order.pricing.totalAmount,
            earnings: order.earnings,
            status: order.status.current,
            deliveredAt: order.assignment.deliveredAt,
            deliveryDuration: order.actualDeliveryDuration,
            feedback: order.feedback
        }));

        res.json({
            success: true,
            orders: historyWithDetails,
            pagination: {
                currentPage: parseInt(page),
                totalOrders: historyWithDetails.length
            }
        });
    } catch (error) {
        console.error('Get order history error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Update location during delivery
router.put('/orders/:orderId/location', protectDelivery, async (req, res) => {
    try {
        const { orderId } = req.params;
        const { latitude, longitude } = req.body;
        
        const order = await Order.findById(orderId);
        
        if (!order) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }

        if (order.assignment.deliveryAgent.toString() !== req.deliveryAgent.agentId) {
            return res.status(403).json({ success: false, message: 'You are not assigned to this order' });
        }

        // Update tracking location
        order.tracking.agentLocation = {
            latitude,
            longitude,
            lastUpdated: new Date()
        };

        // Also update agent's current location
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        await agent.updateLocation(latitude, longitude);

        await order.save();

        res.json({
            success: true,
            message: 'Location updated successfully'
        });
    } catch (error) {
        console.error('Update location error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

// Get earnings summary
router.get('/earnings/summary', protectDelivery, async (req, res) => {
    try {
        const { period = 'today' } = req.query;
        const agent = await DeliveryAgent.findById(req.deliveryAgent.agentId);
        
        let dateFilter = {};
        const now = new Date();
        
        switch (period) {
            case 'today':
                const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
                dateFilter = { 'assignment.deliveredAt': { $gte: startOfDay } };
                break;
            case 'week':
                const startOfWeek = new Date(now.setDate(now.getDate() - now.getDay()));
                dateFilter = { 'assignment.deliveredAt': { $gte: startOfWeek } };
                break;
            case 'month':
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
                dateFilter = { 'assignment.deliveredAt': { $gte: startOfMonth } };
                break;
        }

        const deliveredOrders = await Order.find({
            'assignment.deliveryAgent': req.deliveryAgent.agentId,
            'status.current': 'delivered',
            ...dateFilter
        });

        const summary = {
            totalEarnings: deliveredOrders.reduce((sum, order) => sum + order.earnings.total, 0),
            totalDeliveries: deliveredOrders.length,
            averageEarningPerDelivery: deliveredOrders.length > 0 ? 
                deliveredOrders.reduce((sum, order) => sum + order.earnings.total, 0) / deliveredOrders.length : 0,
            totalTips: deliveredOrders.reduce((sum, order) => sum + order.earnings.tip, 0),
            totalBonuses: deliveredOrders.reduce((sum, order) => sum + (order.earnings.distanceBonus + order.earnings.priorityBonus), 0),
            agentTotalEarnings: agent.status.earnings.total,
            agentMonthlyEarnings: agent.status.earnings.thisMonth
        };

        res.json({
            success: true,
            period,
            summary
        });
    } catch (error) {
        console.error('Get earnings summary error:', error);
        res.status(500).json({ success: false, message: 'Server error' });
    }
});

export default router;