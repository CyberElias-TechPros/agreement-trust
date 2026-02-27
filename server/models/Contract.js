import mongoose from 'mongoose';

const contractSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  contractNumber: {
    type: String,
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 500,
  },
  currentDescription: {
    type: String,
    required: true,
  },
  currentDeadline: {
    type: Date,
    default: null,
  },
  currentPriority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  currentStatus: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'in_progress', 'submitted', 'approved', 'rejected', 'archived'],
    default: 'draft',
  },
  initiator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  responsibleExecutor: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    default: null,
  },
  tags: [{
    type: String,
  }],
  attachments: [{
    id: String,
    filename: String,
    url: String,
    uploadedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    uploadedAt: {
      type: Date,
      default: Date.now,
    },
  }],
  // Timestamps for state transitions
  sentAt: {
    type: Date,
    default: null,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
  completedAt: {
    type: Date,
    default: null,
  },
  approvedAt: {
    type: Date,
    default: null,
  },
  archivedAt: {
    type: Date,
    default: null,
  },
  // Version control
  currentVersion: {
    type: Number,
    default: 1,
  },
  isDeleted: {
    type: Boolean,
    default: false,
  },
}, {
  timestamps: true,
});

// Compound indexes for performance
contractSchema.index({ organization: 1, currentStatus: 1 });
contractSchema.index({ organization: 1, contractNumber: 1 }, { unique: true });
contractSchema.index({ initiator: 1 });
contractSchema.index({ responsibleExecutor: 1 });
contractSchema.index({ currentDeadline: 1 });
contractSchema.index({ organization: 1, createdAt: -1 });

// Generate contract number before saving
contractSchema.pre('save', async function(next) {
  if (this.isNew && !this.contractNumber) {
    const org = await mongoose.model('Organization').findById(this.organization);
    const count = await mongoose.model('Contract').countDocuments({ organization: this.organization });
    const year = new Date().getFullYear();
    this.contractNumber = `${org?.slug?.toUpperCase() || 'TCP'}-${year}-${String(count + 1).padStart(5, '0')}`;
  }
  next();
});

// Text search index
contractSchema.index({ title: 'text', currentDescription: 'text' });

contractSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Contract', contractSchema);
