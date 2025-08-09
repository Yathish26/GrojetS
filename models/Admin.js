import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const AdminSchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true, minlength: 6, select: false },
    role: { 
        type: String, 
        enum: ['super_admin', 'admin', 'delivery_manager', 'inventory_manager'], 
        default: 'admin' 
    },
    isActive: { type: Boolean, default: true },
    twofactorAuth: { type: Boolean, default: false },
    department: { type: String }, // e.g., 'Operations', 'Finance', 'HR'
    lastLogin: { type: Date },
    passwordLastChanged: { type: Date, default: Date.now },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'Admin' },
    avatar: { type: String },
    phone: { type: String },
    address: { type: String }
}, { timestamps: true });

AdminSchema.pre('save', async function (next) {
    if (!this.isModified('password')) return next();
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
});

AdminSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const Admin = mongoose.model('Admin', AdminSchema);
export default Admin;
