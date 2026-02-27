import mongoose from 'mongoose';

const notificationSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  type: {
    type: String,
    enum: [
      'contract_assigned',
      'contract_sent',
      'contract_accepted',
      'contract_rejected',
      'contract_submitted',
      'contract_approved',
      'contract_archived',
      'status_changed',
      'deadline_approaching',
      'new_interaction',
      'version_updated',
      'mention',
    ],
    required: true,
  },
  title: {
    type: String,
    required: true,
    maxlength: 255,
  },
  content: {
    type: String,
    default: null,
  },
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    default: null,
  },
  actionUrl: {
    type: String,
    default: null,
  },
  inAppReadAt: {
    type: Date,
    default: null,
  },
  emailSentAt: {
    type: Date,
    default: null,
  },
  emailDeliveredAt: {
    type: Date,
    default: null,
  },
  pushSentAt: {
    type: Date,
    default: null,
  },
}, {
  timestamps: true,
});

notificationSchema.index({ user: 1, inAppReadAt: 1, createdAt: -1 });
notificationSchema.index({ user: 1, organization: 1 });
notificationSchema.index({ contract: 1 });

notificationSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Notification', notificationSchema);
