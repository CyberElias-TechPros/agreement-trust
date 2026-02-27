import mongoose from 'mongoose';

const contractVersionSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
  },
  versionNumber: {
    type: Number,
    required: true,
  },
  description: {
    type: String,
    required: true,
  },
  deadline: {
    type: Date,
    default: null,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'critical'],
    default: 'medium',
  },
  scopeChanges: {
    type: String,
    default: null,
  },
  changedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  changeReason: {
    type: String,
    default: null,
  },
  diffFromPrevious: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

contractVersionSchema.index({ contract: 1, versionNumber: 1 }, { unique: true });
contractVersionSchema.index({ contract: 1, createdAt: -1 });

contractVersionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('ContractVersion', contractVersionSchema);
