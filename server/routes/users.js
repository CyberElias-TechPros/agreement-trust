import express from 'express';
import { User } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isId } from '../utils/validate.js';

const router = express.Router();

/** Escape user input before it is interpolated into a MongoDB $regex. */
const escapeRegex = (value) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

/** The requester must be an active member of the organization. */
async function requireOrgMember(organizationId, userId) {
  if (!isId(organizationId)) return false;
  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: userId,
    organization: organizationId,
    status: 'active',
  }).lean();
  return Boolean(membership);
}

// Get all users in organization
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const { Membership } = await import('../models/index.js');

  // Get all members in the organization
  const memberships = await Membership.find({
    organization: organizationId,
    status: 'active',
  }).populate('user', 'firstName lastName email avatarUrl').lean();

  const users = memberships.map(m => ({
    id: m.user._id,
    firstName: m.user.firstName,
    lastName: m.user.lastName,
    email: m.user.email,
    avatarUrl: m.user.avatarUrl,
    role: m.role,
  }));

  res.json({ users });
}));

// Search users in organization
router.get('/search', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const rawQ = typeof req.query.q === 'string' ? req.query.q.trim() : '';
  const rawLimit = Number.parseInt(String(req.query.limit ?? '10'), 10);

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (rawQ.length < 2) {
    return res.json({ users: [] });
  }

  const { Membership } = await import('../models/index.js');
  const q = escapeRegex(rawQ.slice(0, 100));
  const limit = Math.min(Math.max(Number.isFinite(rawLimit) ? rawLimit : 10, 1), 50);

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
    .limit(limit)
    .lean();

  res.json({ users });
}));

// Get user by ID
router.get('/:userId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, userId } = req.params;

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!isId(userId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid userId'] });
  }

  const user = await User.findById(userId)
    .select('firstName lastName email avatarUrl')
    .lean();

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  res.json({ user });
}));

export default router;
