import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    personalInfo: {
        name: { type: String, trim: true },
        email: { type: String, trim: true, lowercase: true, unique: true, sparse: true },
        phone: { type: String, required: true, unique: true },
        dateOfBirth: { type: Date },
        gender: { type: String, enum: ['male', 'female', 'other'] },
        avatar: { type: String }
    },
    
    authentication: {
        password: { type: String, required: true, minlength: 6, select: false },
        isEmailVerified: { type: Boolean, default: false },
        isPhoneVerified: { type: Boolean, default: false },
        lastLogin: { type: Date },
        loginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date }
    },
    
    addresses: [{
        type: { type: String, enum: ['home', 'office', 'other'], default: 'home' },
        street: { type: String, required: true },
        landmark: { type: String },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
    alternateNumber: { type: String },
        coordinates: {
            latitude: { type: Number },
            longitude: { type: Number }
        },
        isDefault: { type: Boolean, default: false }
    }],
    
    preferences: {
        language: { type: String, default: 'en' },
        currency: { type: String, default: 'INR' },
        notifications: {
            email: { type: Boolean, default: true },
            sms: { type: Boolean, default: true },
            push: { type: Boolean, default: true },
            marketing: { type: Boolean, default: false }
        },
        deliveryInstructions: { type: String }
    },
    
    orderHistory: {
        totalOrders: { type: Number, default: 0 },
        totalSpent: { type: Number, default: 0 },
        averageOrderValue: { type: Number, default: 0 },
        lastOrderDate: { type: Date },
        favoriteItems: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product' }],
        preferredMerchants: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Merchant' }]
    },

    
    loyalty: {
        points: { type: Number, default: 0 },
        tier: { type: String, enum: ['bronze', 'silver', 'gold', 'platinum'], default: 'bronze' },
        referralCode: { type: String, unique: true },
        referredBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User' },
        referrals: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }]
    },
    
    status: { 
        isActive: { type: Boolean, default: false },
        accountStatus: { type: String, enum: ['active', 'inactive', 'suspended', 'banned'], default: 'active' },
        suspensionReason: { type: String },
        suspendedUntil: { type: Date }
    },

    warnings: [{
        reason: { type: String, required: true },
        addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        addedAt: { type: Date, default: Date.now }
    }],
    
    support: {
        tickets: [{ type: mongoose.Schema.Types.ObjectId, ref: 'SupportTicket' }],
        notes: [{ 
            note: { type: String },
            addedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
            addedAt: { type: Date, default: Date.now }
        }]
    },

    // User wishlist of products
    wishlist: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Product', index: true }],

    // Payment Methods (basic, non-PCI storage: only last4 + metadata, never full PAN/CVV)
    paymentMethods: {
        cards: [{
            brand: { type: String, enum: ['visa', 'mastercard', 'unknown'], default: 'unknown' },
            last4: { type: String },
            expiryMonth: { type: Number },
            expiryYear: { type: Number },
            nameOnCard: { type: String },
            isDefault: { type: Boolean, default: false },
            addedAt: { type: Date, default: Date.now }
        }],
        upi: {
            id: { type: String },
            addedAt: { type: Date }
        }
    },

    // Notification preferences (mirrors mobile toggles)
    notificationPreferences: {
        generalNotifications: { type: Boolean, default: true },
        emailNotifications: { type: Boolean, default: true },
        orderUpdates: { type: Boolean, default: true },
        promotionsOffers: { type: Boolean, default: false },
        appUpdates: { type: Boolean, default: true },
        securityAlerts: { type: Boolean, default: true }
    }
}, { timestamps: true });

UserSchema.pre('save', async function (next) {
    if (!this.isModified('authentication.password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.authentication.password = await bcrypt.hash(this.authentication.password, salt);
    next();
});

// Generate referral code
UserSchema.pre('save', function(next) {
    if (!this.loyalty.referralCode) {
        const base = (this.personalInfo?.name || 'USR').toString();
        const prefix = base.substring(0, 3).toUpperCase();
        this.loyalty.referralCode = `GRO${prefix}${Date.now().toString().slice(-4)}`;
    }
    next();
});

UserSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.authentication.password);
};

// Virtual for full name
UserSchema.virtual('fullName').get(function() {
    return this.personalInfo.name;
});

// Method to add loyalty points
UserSchema.methods.addLoyaltyPoints = function(points, reason) {
    this.loyalty.points += points;
    // Update tier based on points
    if (this.loyalty.points >= 10000) this.loyalty.tier = 'platinum';
    else if (this.loyalty.points >= 5000) this.loyalty.tier = 'gold';
    else if (this.loyalty.points >= 1000) this.loyalty.tier = 'silver';
    else this.loyalty.tier = 'bronze';
    
    return this.save();
};

// Spend loyalty points (with guard)
UserSchema.methods.spendLoyaltyPoints = function(points) {
    if (points <= 0) throw new Error('Points must be positive');
    if (this.loyalty.points < points) throw new Error('Insufficient points');
    this.loyalty.points -= points;
    // Recalculate tier downward if needed
    if (this.loyalty.points >= 10000) this.loyalty.tier = 'platinum';
    else if (this.loyalty.points >= 5000) this.loyalty.tier = 'gold';
    else if (this.loyalty.points >= 1000) this.loyalty.tier = 'silver';
    else this.loyalty.tier = 'bronze';
    return this.save();
};

// Method to get default address
UserSchema.methods.getDefaultAddress = function() {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
};

// Add product to wishlist (idempotent)
UserSchema.methods.addToWishlist = async function(productId) {
    if (!this.wishlist) this.wishlist = [];
    const exists = this.wishlist.some(id => id.toString() === productId.toString());
    if (!exists) {
        this.wishlist.push(productId);
        await this.save();
    }
    return this.wishlist;
};

// Remove product from wishlist
UserSchema.methods.removeFromWishlist = async function(productId) {
    if (!this.wishlist) return this.wishlist;
    this.wishlist = this.wishlist.filter(id => id.toString() !== productId.toString());
    await this.save();
    return this.wishlist;
};

// Toggle wishlist
UserSchema.methods.toggleWishlistItem = async function(productId) {
    if (!this.wishlist) this.wishlist = [];
    const index = this.wishlist.findIndex(id => id.toString() === productId.toString());
    if (index === -1) {
        this.wishlist.push(productId);
        await this.save();
        return { action: 'added', wishlist: this.wishlist };
    } else {
        this.wishlist.splice(index, 1);
        await this.save();
        return { action: 'removed', wishlist: this.wishlist };
    }
};

const User = mongoose.model('User', UserSchema);
export default User;