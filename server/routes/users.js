import express from 'express';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Search users in organization
router.get('/:organizationId/search', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { q, limit = 10 } = req.query;

  if (!q || q.length < 2) {
    return res.json({ users: [] });
  }

  const { Membership } = await import('../models/index.js');
  
  // Get user IDs in the organization
  const memberships = await Membership.find({ 
    organization: organizationId,
    status: 'active',
  }).select('user').lean();

  const userIds = memberships.map(m => m.user);

  // Search users by name or email
  const users = await User.find({
    _id: { $in: userIds },
    $or: [
      { firstName: { $regex: q, $options: 'i' } },
      { lastName: { $regex: q, $options: 'i' } },
      { email: { $regex: q, $options: 'i' } },
    ],
  })
    .select('firstName lastName email avatarUrl')
    .limit(parseInt(limit))
    .lean();

  res.json({ users });
}));

// Get user by ID
router.get('/:organizationId/:userId', authenticate, asyncHandler(async (req, res) => {
  const { userId } = req.params;

  const user = await User.findById(userId)
    .select('firstName lastName email avatarUrl')
    .lean();

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}));

export default router;
