import mongoose from 'mongoose';

const categorySchema = new mongoose.Schema({
  organization: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Organization',
    required: true,
  },
  name: {
    type: String,
    required: true,
    maxlength: 100,
  },
  color: {
    type: String,
    default: '#3B82F6',
  },
  description: {
    type: String,
    default: null,
  },
}, {
  timestamps: true,
});

categorySchema.index({ organization: 1, name: 1 }, { unique: true });

categorySchema.set('toJSON', {
  virtuals: true,
  transform: function(doc, ret) {
    ret.id = ret._id;
    delete ret.__v;
    return ret;
  }
});

export default mongoose.model('Category', categorySchema);
