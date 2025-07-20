import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },

  icon: { type: String },   // Optional: small icon URL
  image: { type: String },  // Optional: banner or thumbnail
  parentId: { type: mongoose.Schema.Types.ObjectId, ref: 'Category', default: null },
  level: { type: Number, default: 1 }, // Calculated automatically

  isActive: { type: Boolean, default: true },
  showOnHome: { type: Boolean, default: false },
  order: { type: Number, default: 0 } // Custom sort order
}, { timestamps: true });

categorySchema.pre('save', async function (next) {
  if ((!this.slug || this.isModified('name')) && this.name) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  if (this.parentId) {
    const parent = await mongoose.model('Category').findById(this.parentId);
    if (parent) {
      this.level = parent.level + 1;
    } else {
      return next(new Error('Invalid parent category'));
    }
  } else {
    this.level = 1;
  }

  next();
});

const Category = mongoose.model('Category', categorySchema);
export default Category;
