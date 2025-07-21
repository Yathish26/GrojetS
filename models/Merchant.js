import mongoose from 'mongoose';

const MerchantSchema = new mongoose.Schema({
    businessName: { type: String, required: true, trim: true, maxlength: 50 },
    contactPerson: { type: String, required: true, trim: true, maxlength: 40 },
    email: { type: String, required: true, unique: true, maxlength: 60 },
    phone: { type: String, required: true, trim: true, maxlength: 15 },
    businessType: { type: String, required: true, trim: true, maxlength: 50 },
    address: { type: String, required: true, trim: true, maxlength: 200 },
    message: { type: String, trim: true, maxlength: 500 },
    registrationDate: { type: Date, default: Date.now }
});

const Merchant = mongoose.model('Merchant', MerchantSchema);
export default Merchant;