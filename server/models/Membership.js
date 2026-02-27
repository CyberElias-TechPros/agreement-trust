import mongoose from 'mongoose';

const membershipSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['owner', 'admin', 'manager', 'executor', 'observer'],
    default: 'executor',
  },
  department: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Department',
    default: null,
  },
  invitedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  status: {
    type: String,
    enum: ['active', 'suspended', 'pending'],
    default: 'active',
  },
}, {
  timestamps: true,
});

// Unique compound index
membershipSchema.index({ organization: 1, user: 1 }, { unique: true });
membershipSchema.index({ organization: 1, role: 1 });
membershipSchema.index({ user: 1, status: 1 });

membershipSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Membership', membershipSchema);
