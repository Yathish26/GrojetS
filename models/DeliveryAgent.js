import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const DeliveryAgentSchema = new mongoose.Schema({
    personalInfo: {
        firstName: { type: String, required: true, trim: true },
        lastName: { type: String, required: true, trim: true },
        email: { type: String, unique: true },
        phone: { type: String, required: true, unique: true },
        dateOfBirth: { type: Date, required: true },
        gender: { type: String, enum: ['male', 'female', 'other'], required: true },
        profilePhoto: { type: String }
    },
    
    address: {
        street: { type: String, required: true },
        city: { type: String, required: true },
        state: { type: String, required: true },
        zipCode: { type: String, required: true },
        landmark: { type: String }
    },
    
    documents: {
        aadharFront: { type: String, required: true },
        aadharBack: { type: String, required: true },
        panCard: { type: String, required: true },
        drivingLicense: { type: String },
        bankAccount: {
            accountNumber: { type: String, required: true },
            ifscCode: { type: String, required: true },
            bankName: { type: String, required: true },
            accountHolderName: { type: String, required: true }
        }
    },
    
    vehicleInfo: {
        vehicleType: { type: String, enum: ['bike', 'bicycle', 'scooter', 'car'], required: true },
        vehicleNumber: { type: String, required: true },
        rcBook: { type: String, required: true },
        insurance: { type: String, required: true },
        puc: { type: String }
    },
    
    workInfo: {
        preferredAreas: [{ type: String }],
        availabilityHours: {
            start: { type: String, required: true }, // "09:00"
            end: { type: String, required: true } // "22:00"
        },
        workingDays: [{ type: String, enum: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'] }],
        expectedSalary: { type: Number },
        experience: { type: String }
    },
    
    authentication: {
        password: { type: String, required: true, minlength: 6, select: false },
        isEmailVerified: { type: Boolean, default: false },
        isPhoneVerified: { type: Boolean, default: false },
        lastLogin: { type: Date }
    },
    
    status: {
        applicationStatus: { 
            type: String, 
            enum: ['pending', 'under_review', 'approved', 'rejected', 'suspended'], 
            default: 'pending' 
        },
        isActive: { type: Boolean, default: false },
        isOnline: { type: Boolean, default: false },
        currentLocation: {
            latitude: { type: Number },
            longitude: { type: Number },
            lastUpdated: { type: Date }
        },
        deliveryZone: { type: String },
        rating: { type: Number, default: 5.0, min: 1, max: 5 },
        totalDeliveries: { type: Number, default: 0 },
        completedDeliveries: { type: Number, default: 0 },
        earnings: {
            total: { type: Number, default: 0 },
            thisMonth: { type: Number, default: 0 },
            lastPayout: { type: Date }
        }
    },
    
    verification: {
        documentsVerified: { type: Boolean, default: false },
        backgroundCheckPassed: { type: Boolean, default: false },
        trainingCompleted: { type: Boolean, default: false },
        verifiedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
        verifiedAt: { type: Date },
        rejectionReason: { type: String }
    },
    
    emergencyContact: {
        name: { type: String, required: true },
        relationship: { type: String, required: true },
        phone: { type: String, required: true }
    }
}, { timestamps: true });

DeliveryAgentSchema.pre('save', async function (next) {
    if (!this.isModified('authentication.password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.authentication.password = await bcrypt.hash(this.authentication.password, salt);
    next();
});

DeliveryAgentSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.authentication.password);
};

DeliveryAgentSchema.virtual('fullName').get(function() {
    return `${this.personalInfo.firstName} ${this.personalInfo.lastName}`;
});

DeliveryAgentSchema.methods.updateLocation = function(lat, lng) {
    this.status.currentLocation = {
        latitude: lat,
        longitude: lng,
        lastUpdated: new Date()
    };
    return this.save();
};

const DeliveryAgent = mongoose.model('DeliveryAgent', DeliveryAgentSchema);
export default DeliveryAgent;
