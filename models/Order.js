import mongoose from 'mongoose';

const OrderSchema = new mongoose.Schema({
    orderNumber: { 
        type: String, 
        required: true, 
        unique: true,
        default: function() {
            return 'GJD' + Math.floor(Math.random() * 900000 + 100000);
        }
    },
    
    customer: {
        userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        email: { type: String },
        address: {
            street: { type: String, required: true },
            landmark: { type: String },
            city: { type: String, required: true },
            state: { type: String, required: true },
            zipCode: { type: String, required: true },
            coordinates: {
                latitude: { type: Number },
                longitude: { type: Number }
            },
            addressType: { type: String, enum: ['home', 'office', 'other'], default: 'home' }
        }
    },

    restaurant: {
        merchantId: { type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' },
        name: { type: String, required: true },
        phone: { type: String, required: true },
        address: {
            street: { type: String, required: true },
            landmark: { type: String },
            city: { type: String, required: true },
            state: { type: String, required: true },
            zipCode: { type: String, required: true },
            coordinates: {
                latitude: { type: Number, required: true },
                longitude: { type: Number, required: true }
            }
        }
    },

    items: [{
        productId: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
        name: { type: String, required: true },
        quantity: { type: Number, required: true, min: 1 },
        price: { type: Number, required: true },
        discountedPrice: { type: Number },
        image: { type: String },
        category: { type: String },
        specialInstructions: { type: String }
    }],

    pricing: {
        itemsTotal: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        deliveryFee: { type: Number, required: true },
        platformFee: { type: Number, default: 0 },
        tip: { type: Number, default: 0 },
        taxes: { type: Number, default: 0 },
        totalAmount: { type: Number, required: true },
        couponCode: { type: String },
        couponDiscount: { type: Number, default: 0 }
    },

    deliveryInfo: {
        estimatedTime: { type: Number, required: true }, // in minutes
        distance: { type: Number, required: true }, // in kilometers
        deliveryInstructions: { type: String },
        priority: { 
            type: String, 
            enum: ['normal', 'high', 'urgent'], 
            default: 'normal' 
        },
        deliverySlot: {
            startTime: { type: Date },
            endTime: { type: Date }
        }
    },

    status: {
        current: { 
            type: String, 
            enum: ['pending', 'confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit', 'delivered', 'cancelled'],
            default: 'pending'
        },
        timeline: [{
            status: { type: String, required: true },
            timestamp: { type: Date, default: Date.now },
            location: {
                latitude: { type: Number },
                longitude: { type: Number }
            },
            notes: { type: String },
            updatedBy: { type: String } // 'customer', 'restaurant', 'delivery_agent', 'system'
        }]
    },

    assignment: {
        deliveryAgent: { 
            type: mongoose.Schema.Types.ObjectId, 
            ref: 'DeliveryAgent',
            default: null
        },
        assignedAt: { type: Date },
        acceptedAt: { type: Date },
        rejectedBy: [{ 
            agentId: { type: mongoose.Schema.Types.ObjectId, ref: 'DeliveryAgent' },
            rejectedAt: { type: Date, default: Date.now },
            reason: { type: String }
        }],
        pickedUpAt: { type: Date },
        deliveredAt: { type: Date },
        estimatedDeliveryTime: { type: Date },
        actualDeliveryTime: { type: Date }
    },

    payment: {
        method: { 
            type: String, 
            enum: ['cash', 'card', 'wallet', 'upi'], 
            required: true 
        },
        status: { 
            type: String, 
            enum: ['pending', 'paid', 'failed', 'refunded'], 
            default: 'pending' 
        },
        transactionId: { type: String },
        paidAt: { type: Date },
        gatewayResponse: { type: mongoose.Schema.Types.Mixed }
    },

    earnings: {
        deliveryFee: { type: Number, required: true },
        tip: { type: Number, default: 0 },
        distanceBonus: { type: Number, default: 0 },
        priorityBonus: { type: Number, default: 0 },
        total: { type: Number, required: true }
    },

    feedback: {
        deliveryRating: { type: Number, min: 1, max: 5 },
        deliveryComment: { type: String },
        foodRating: { type: Number, min: 1, max: 5 },
        foodComment: { type: String },
        submittedAt: { type: Date }
    },

    tracking: {
        agentLocation: {
            latitude: { type: Number },
            longitude: { type: Number },
            lastUpdated: { type: Date }
        },
        estimatedArrival: { type: Date },
        deliveryOTP: { type: String }
    },

    cancellation: {
        reason: { type: String },
        cancelledBy: { 
            type: String, 
            enum: ['customer', 'restaurant', 'delivery_agent', 'admin']
        },
        cancelledAt: { type: Date },
        refundAmount: { type: Number, default: 0 },
        refundStatus: { 
            type: String, 
            enum: ['pending', 'processed', 'failed'], 
            default: 'pending' 
        }
    },

    specialRequests: [{
        type: { type: String }, // 'contactless', 'leave_at_door', etc.
        description: { type: String },
        isActive: { type: Boolean, default: true }
    }]
}, { 
    timestamps: true,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
});

// Virtual for order age
OrderSchema.virtual('orderAge').get(function() {
    return Math.floor((Date.now() - this.createdAt) / (1000 * 60)); // in minutes
});

// Virtual for delivery time
OrderSchema.virtual('actualDeliveryDuration').get(function() {
    if (this.assignment.deliveredAt && this.assignment.acceptedAt) {
        return Math.floor((this.assignment.deliveredAt - this.assignment.acceptedAt) / (1000 * 60)); // in minutes
    }
    return null;
});

// Index for efficient queries
OrderSchema.index({ 'status.current': 1, createdAt: -1 });
OrderSchema.index({ 'assignment.deliveryAgent': 1, 'status.current': 1 });
OrderSchema.index({ 'customer.phone': 1 });
OrderSchema.index({ 'restaurant.merchantId': 1, 'status.current': 1 });
OrderSchema.index({ createdAt: -1 });

// Pre-save middleware to generate OTP for delivery
OrderSchema.pre('save', function(next) {
    if (this.isNew || this.isModified('status.current')) {
        if (this.status.current === 'picked_up' && !this.tracking.deliveryOTP) {
            this.tracking.deliveryOTP = Math.floor(1000 + Math.random() * 9000).toString();
        }
    }
    next();
});

// Method to update order status with location tracking
OrderSchema.methods.updateStatus = function(newStatus, location = null, notes = '', updatedBy = 'system') {
    this.status.current = newStatus;
    this.status.timeline.push({
        status: newStatus,
        timestamp: new Date(),
        location,
        notes,
        updatedBy
    });

    // Update assignment timestamps
    switch(newStatus) {
        case 'picked_up':
            this.assignment.pickedUpAt = new Date();
            break;
        case 'delivered':
            this.assignment.deliveredAt = new Date();
            this.assignment.actualDeliveryTime = new Date();
            break;
    }

    return this.save();
};

// Method to assign delivery agent
OrderSchema.methods.assignAgent = function(agentId) {
    this.assignment.deliveryAgent = agentId;
    this.assignment.assignedAt = new Date();
    this.assignment.estimatedDeliveryTime = new Date(Date.now() + this.deliveryInfo.estimatedTime * 60 * 1000);
    
    return this.updateStatus('confirmed', null, `Order assigned to delivery agent`, 'system');
};

// Method to accept order by delivery agent
OrderSchema.methods.acceptByAgent = function(agentId, location = null) {
    if (this.assignment.deliveryAgent && this.assignment.deliveryAgent.toString() === agentId.toString()) {
        this.assignment.acceptedAt = new Date();
        return this.updateStatus('preparing', location, 'Order accepted by delivery agent', 'delivery_agent');
    }
    throw new Error('Agent not authorized to accept this order');
};

// Method to reject order by delivery agent
OrderSchema.methods.rejectByAgent = function(agentId, reason = '') {
    this.assignment.rejectedBy.push({
        agentId: agentId,
        rejectedAt: new Date(),
        reason: reason
    });
    
    // Reset assignment
    this.assignment.deliveryAgent = null;
    this.assignment.assignedAt = null;
    
    return this.updateStatus('pending', null, `Order rejected: ${reason}`, 'delivery_agent');
};

// Method to calculate earnings for delivery agent
OrderSchema.methods.calculateAgentEarnings = function() {
    const baseDeliveryFee = this.pricing.deliveryFee * 0.75; // 75% to agent, 25% platform fee
    const tipAmount = this.pricing.tip;
    
    // Distance bonus: ₹5 per extra km after 3km
    let distanceBonus = 0;
    if (this.deliveryInfo.distance > 3) {
        distanceBonus = (this.deliveryInfo.distance - 3) * 5;
    }

    // Priority bonus
    let priorityBonus = 0;
    if (this.deliveryInfo.priority === 'high') priorityBonus = 15;
    if (this.deliveryInfo.priority === 'urgent') priorityBonus = 30;

    // Time-based bonus (peak hours: 12-2 PM, 7-10 PM)
    const hour = new Date().getHours();
    let timeBonus = 0;
    if ((hour >= 12 && hour <= 14) || (hour >= 19 && hour <= 22)) {
        timeBonus = 10;
    }

    const total = baseDeliveryFee + tipAmount + distanceBonus + priorityBonus + timeBonus;

    this.earnings = {
        deliveryFee: baseDeliveryFee,
        tip: tipAmount,
        distanceBonus: distanceBonus,
        priorityBonus: priorityBonus + timeBonus,
        total: total
    };

    return this.earnings;
};

// Method to get delivery summary for agent
OrderSchema.methods.getDeliverySummary = function() {
    return {
        orderNumber: this.orderNumber,
        customer: {
            name: this.customer.name,
            phone: this.customer.phone,
            address: this.customer.address
        },
        restaurant: {
            name: this.restaurant.name,
            phone: this.restaurant.phone,
            address: this.restaurant.address
        },
        items: this.items,
        totalAmount: this.pricing.totalAmount,
        deliveryInfo: this.deliveryInfo,
        earnings: this.calculateAgentEarnings(),
        status: this.status.current,
        specialRequests: this.specialRequests.filter(req => req.isActive),
        deliveryOTP: this.tracking.deliveryOTP
    };
};

// Static method to find available orders for assignment
OrderSchema.statics.findAvailableOrders = function(agentLocation, maxDistance = 10) {
    return this.find({
        'status.current': 'pending',
        'assignment.deliveryAgent': null
    }).sort({ createdAt: 1 }).limit(10);
};

// Static method to get agent's active orders
OrderSchema.statics.getAgentActiveOrders = function(agentId) {
    return this.find({
        'assignment.deliveryAgent': agentId,
        'status.current': { $in: ['confirmed', 'preparing', 'ready_for_pickup', 'picked_up', 'in_transit'] }
    }).sort({ 'assignment.acceptedAt': 1 });
};

// Static method to get agent's order history
OrderSchema.statics.getAgentOrderHistory = function(agentId, limit = 50) {
    return this.find({
        'assignment.deliveryAgent': agentId,
        'status.current': { $in: ['delivered', 'cancelled'] }
    }).sort({ 'assignment.deliveredAt': -1, createdAt: -1 }).limit(limit);
};

const Order = mongoose.model('Order', OrderSchema);
export default Order;
