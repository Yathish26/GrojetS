import mongoose from 'mongoose';

const productSchema = new mongoose.Schema({
  name: { type: String, required: true, trim: true },
  slug: { type: String, unique: true, lowercase: true },

  description: { type: String },
  highlights: [{ type: String }],

  images: [{ type: String }],
  thumbnail: { type: String },

  brand: { type: mongoose.Schema.Types.ObjectId, ref: 'Brand' },
  categories: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Category' }], // multi-tag style
  mainCategory: { type: mongoose.Schema.Types.ObjectId, ref: 'Category' }, // inferred parent header

  sku: { type: String, unique: true },
  barcode: { type: String },
  variants: [
    {
      label: String,
      price: Number,
      mrp: Number,
      stock: Number,
      unit: String,
      image: String,
      sellerId: { type: mongoose.Schema.Types.ObjectId, ref: 'Seller' },
    }
  ],

  pricing: {
    mrp: Number,
    sellingPrice: Number,
    discountPercent: Number,
    offerTag: String,
  },

  tax: {
    gstRate: Number,
    includedInPrice: { type: Boolean, default: true }
  },

  stock: {
    quantity: Number,
    status: { type: String, enum: ['in_stock', 'out_of_stock', 'limited'], default: 'in_stock' },
  },

  delivery: {
    isInstant: { type: Boolean, default: true },
    deliveryTimeInMinutes: Number,
    zones: [String],
  },

  isActive: { type: Boolean, default: true },
  isFeatured: { type: Boolean, default: false },

  tags: [{ type: String }],
  searchKeywords: [{ type: String }],

  viewCount: { type: Number, default: 0 },
  soldCount: { type: Number, default: 0 },
}, { timestamps: true });

productSchema.pre('save', async function (next) {
  if ((!this.slug || this.isModified('name')) && this.name) {
    this.slug = this.name.toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-');
  }

  if (this.categories?.length && !this.mainCategory) {
    const cat = await mongoose.model('Category').findById(this.categories[0]);
    if (cat) {
      this.mainCategory = cat.parentId || cat._id;
    }
  }

  next();
});

const Product = mongoose.model('Product', productSchema);
export default Product;