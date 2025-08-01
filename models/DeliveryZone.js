import mongoose from 'mongoose';

const DeliveryZoneSchema = new mongoose.Schema({
    name: { type: String, required: true, unique: true },
    boundaries: {
        type: {
            type: String,
            enum: ['Polygon'],
            required: true
        },
        coordinates: {
            type: [[[Number]]], // Array of linear ring coordinate arrays
            required: true
        }
    },
    isActive: { type: Boolean, default: true },
    deliveryFee: { type: Number, required: true, default: 0 },
    minimumOrderValue: { type: Number, default: 0 },
    estimatedDeliveryTime: { type: Number, required: true }, // in minutes
    maxDeliveryDistance: { type: Number, default: 10 }, // in kilometers
    peakHourMultiplier: { type: Number, default: 1.2 },
    coverage: {
        pinCodes: [{ type: String }],
        areas: [{ type: String }],
        landmarks: [{ type: String }]
    },
    restrictions: {
        cashOnDelivery: { type: Boolean, default: true },
        maxOrderValue: { type: Number },
        blockedItems: [{ type: String }]
    }
}, { timestamps: true });

// Create geospatial index for boundaries
DeliveryZoneSchema.index({ boundaries: '2dsphere' });

const DeliveryZone = mongoose.model('DeliveryZone', DeliveryZoneSchema);
export default DeliveryZone;
