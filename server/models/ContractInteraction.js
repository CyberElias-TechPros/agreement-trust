import mongoose from 'mongoose';

const contractInteractionSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
  },
  author: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  interactionType: {
    type: String,
    enum: [
      'progress_update',
      'clarification_request',
      'clarification_response',
      'scope_proposal',
      'scope_acknowledgment',
      'scope_rejection',
      'issue_report',
      'issue_resolution',
      'submission',
      'approval',
      'rejection',
      'comment',
      'system_note',
    ],
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  structuredData: {
    type: mongoose.Schema.Types.Mixed,
    default: null,
  },
  progressPercentage: {
    type: Number,
    min: 0,
    max: 100,
    default: null,
  },
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
  statusChangeFrom: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'in_progress', 'submitted', 'approved', 'rejected', 'archived'],
    default: null,
  },
  statusChangeTo: {
    type: String,
    enum: ['draft', 'sent', 'accepted', 'in_progress', 'submitted', 'approved', 'rejected', 'archived'],
    default: null,
  },
  isCorrection: {
    type: Boolean,
    default: false,
  },
  correctsInteraction: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'ContractInteraction',
    default: null,
  },
}, {
  timestamps: { createdAt: true, updatedAt: false },
});

contractInteractionSchema.index({ contract: 1, createdAt: -1 });
contractInteractionSchema.index({ author: 1, createdAt: -1 });
contractInteractionSchema.index({ contract: 1, interactionType: 1 });

contractInteractionSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('ContractInteraction', contractInteractionSchema);
