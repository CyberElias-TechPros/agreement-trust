import mongoose from 'mongoose';
import crypto from 'crypto';

const auditLogSchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    default: null,
  },
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    default: null,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null,
  },
  action: {
    type: String,
    required: true,
  },
  entityType: {
    type: String,
    required: true,
  },
  entityId: {
    type: mongoose.Schema.Types.ObjectId,
    required: true,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  userAgent: {
    type: String,
    default: null,
  },
  sessionId: {
    type: String,
    default: null,
  },
  previousState: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  newState: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  checksum: {
    type: String,
    required: true,
  },
}, {
  timestamps: true,
});

// Generate checksum before saving
auditLogSchema.pre('save', function(next) {
  if (this.isNew) {
    const data = `${this.action}${this.entityId}${this.createdAt}${JSON.stringify(this.previousState || {})}`;
    this.checksum = crypto.createHash('sha256').update(data).digest('hex');
  }
  next();
});

auditLogSchema.index({ organization: 1, createdAt: -1 });
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ contract: 1, createdAt: -1 });
auditLogSchema.index({ entityType: 1, entityId: 1 });
auditLogSchema.index({ checksum: 1 });

auditLogSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('AuditLog', auditLogSchema);
