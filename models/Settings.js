import mongoose from 'mongoose';

const SettingsSchema = new mongoose.Schema({
  adminRegistrationPin: { type: String, required: true }, // hashed
  updatedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
  updatedAt: { type: Date, default: Date.now }
});

export default mongoose.model('Settings', SettingsSchema);
