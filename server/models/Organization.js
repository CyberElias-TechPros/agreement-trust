import mongoose from 'mongoose';

const organizationSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
  },
  slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
  },
  planType: {
    type: String,
    enum: ['free', 'pro', 'enterprise'],
    default: 'free',
  },
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  branding: {
    logoUrl: String,
    primaryColor: {
      type: String,
      default: '#3B82F6',
    },
    accentColor: {
      type: String,
      default: '#10B981',
    },
  },
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
}, {
  timestamps: true,
});

// Index for slug
organizationSchema.index({ slug: 1 });

// Validate slug format
organizationSchema.pre('save', function(next) {
  if (this.isModified('slug')) {
    this.slug = this.slug.replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').toLowerCase();
  }
  next();
});

organizationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Organization', organizationSchema);
