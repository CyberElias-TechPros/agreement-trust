import mongoose from 'mongoose';

const contractParticipantSchema = new mongoose.Schema({
  contract: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Contract',
    required: true,
  },
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  role: {
    type: String,
    enum: ['initiator', 'executor', 'observer'],
    required: true,
  },
  isLead: {
    type: Boolean,
    default: false,
  },
  acceptedAt: {
    type: Date,
    default: null,
  },
  status: {
    type: String,
    enum: ['pending', 'active', 'declined', 'removed'],
    default: 'pending',
  },
}, {
  timestamps: true,
});

contractParticipantSchema.index({ contract: 1, user: 1 }, { unique: true });
contractParticipantSchema.index({ user: 1, status: 1 });

contractParticipantSchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('ContractParticipant', contractParticipantSchema);
