import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    personalInfo: {
        name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true },
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
        this.loyalty.referralCode = `GRO${this.personalInfo.name.substring(0, 3).toUpperCase()}${Date.now().toString().slice(-4)}`;
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

// Method to get default address
UserSchema.methods.getDefaultAddress = function() {
    return this.addresses.find(addr => addr.isDefault) || this.addresses[0];
};

const User = mongoose.model('User', UserSchema);
export default User;