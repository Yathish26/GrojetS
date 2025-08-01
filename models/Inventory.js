import mongoose from 'mongoose';

const InventorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, 'Item name is required'],
        trim: true,
        maxlength: [100, 'Item name cannot exceed 100 characters']
    },
    description: {
        type: String,
        trim: true,
        maxlength: [500, 'Description cannot exceed 500 characters']
    },
    category: {
        type: String,
        required: [true, 'Category is required'],
        trim: true
    },
    quantity: {
        type: Number,
        required: [true, 'Quantity is required'],
        min: [0, 'Quantity cannot be negative'],
        default: 0
    },
    unit: {
        type: String,
        required: [true, 'Unit is required'],
        trim: true,
        default: 'pieces'
    },
    price: {
        type: Number,
        required: [true, 'Price is required'],
        min: [0, 'Price cannot be negative']
    },
    supplier: {
        name: {
            type: String,
            trim: true
        },
        contact: {
            type: String,
            trim: true
        },
        email: {
            type: String,
            trim: true,
            lowercase: true
        }
    },
    location: {
        type: String,
        trim: true,
        default: 'Warehouse'
    },
    minStockLevel: {
        type: Number,
        default: 10,
        min: [0, 'Minimum stock level cannot be negative']
    },
    status: {
        type: String,
        enum: ['active', 'inactive', 'discontinued'],
        default: 'active'
    },
    lastUpdated: {
        type: Date,
        default: Date.now
    },
    createdBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Admin',
        required: true
    },
    notes: {
        type: String,
        trim: true,
        maxlength: [1000, 'Notes cannot exceed 1000 characters']
    }
}, {
    timestamps: true
});

// Index for efficient searching
InventorySchema.index({ name: 'text', description: 'text', category: 'text' });
InventorySchema.index({ category: 1 });
InventorySchema.index({ status: 1 });
InventorySchema.index({ quantity: 1 });

// Virtual for low stock items
InventorySchema.virtual('isLowStock').get(function() {
    return this.quantity <= this.minStockLevel;
});

// Update lastUpdated on save
InventorySchema.pre('save', function(next) {
    this.lastUpdated = new Date();
    next();
});

export default mongoose.model('Inventory', InventorySchema);
