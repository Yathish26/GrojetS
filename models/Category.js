import mongoose from 'mongoose';

const mainCategories = [
    "Grocery & Kitchen",
    "Snacks & Drinks",
    "Beauty & Personal Care",
    "Household Essentials",
    "Health & Wellness",
]

const categorySchema = new mongoose.Schema({
    name: { type: String, required: true, trim: true },
    slug: { type: String, unique: true, lowercase: true },
    image: { type: String },

    mainCategory: {
        type: String,
        enum: mainCategories,
        required: true
    },

    isActive: { type: Boolean, default: true },
    showOnHome: { type: Boolean, default: false },
    order: { type: Number, default: 0 }
}, { timestamps: true });

categorySchema.pre('save', function (next) {
    if ((!this.slug || this.isModified('name')) && this.name) {
        this.slug = this.name.toLowerCase()
            .replace(/[^a-z0-9\s-]/g, '')
            .replace(/\s+/g, '-')
            .replace(/-+/g, '-');
    }

    next();
});

const Category = mongoose.model('Category', categorySchema);
export default Category;