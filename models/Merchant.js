import mongoose from 'mongoose';

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
export default Merchant;