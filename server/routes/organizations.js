import express from 'express';
import { Organization, Membership, User, Contract, AuditLog } from '../models/index.js';
import { authenticate, requireRole, canPerformAction } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get user's organizations
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const memberships = await Membership.find({ user: req.userId, status: 'active' })
    .populate('organization')
    .lean();
  
  const organizations = memberships.map(m => ({
    ...m.organization,
    role: m.role,
  }));

  res.json({ organizations });
}));

// Create organization
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { name, slug } = req.body;

  // Check slug uniqueness
  const existing = await Organization.findOne({ slug: slug?.toLowerCase() });
  if (existing) {
    return res.status(400).json({ error: 'Slug already taken' });
  }

  const org = new Organization({
    name,
    slug: slug?.toLowerCase() || `${name.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
    owner: req.userId,
  });

  await org.save();

  // Create owner membership
  await Membership.create({
    organization: org._id,
    user: req.userId,
    role: 'owner',
    status: 'active',
  });

  await AuditLog.create({
    user: req.userId,
    organization: org._id,
    action: 'organization_created',
    entityType: 'organization',
    entityId: org._id,
    newState: { name: org.name, slug: org.slug },
  });

  res.status(201).json({ organization: org.toJSON() });
}));

// Get single organization
router.get('/:organizationId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  }).populate('organization');

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  res.json({
    organization: {
      ...membership.organization.toJSON(),
      role: membership.role,
    },
  });
}));

// Update organization
router.patch('/:organizationId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { name, branding, settings } = req.body;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'update', 'organization')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const org = await Organization.findById(organizationId);
  const previousState = { name: org.name, branding: org.branding };

  if (name) org.name = name;
  if (branding) org.branding = { ...org.branding, ...branding };
  if (settings) org.settings = { ...org.settings, ...settings };

  await org.save();

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    action: 'organization_updated',
    entityType: 'organization',
    entityId: org._id,
    previousState,
    newState: { name: org.name, branding: org.branding },
  });

  res.json({ organization: org.toJSON() });
}));

// Get organization members
router.get('/:organizationId/members', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const members = await Membership.find({ organization: organizationId, status: 'active' })
    .populate('user', 'firstName lastName email avatarUrl')
    .populate('department', 'name')
    .lean();

  res.json({
    members: members.map(m => ({
      id: m._id,
      user: m.user,
      role: m.role,
      department: m.department,
      joinedAt: m.createdAt,
    })),
  });
}));

// Invite member to organization
router.post('/:organizationId/members', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { email, role, departmentId } = req.body;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'create', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Find user by email
  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(404).json({ error: 'User not found. They must register first.' });
  }

  // Check if already member
  const existingMembership = await Membership.findOne({
    user: user._id,
    organization: organizationId,
  });

  if (existingMembership) {
    return res.status(400).json({ error: 'User is already a member' });
  }

  // Create membership
  const newMembership = await Membership.create({
    organization: organizationId,
    user: user._id,
    role: role || 'executor',
    department: departmentId,
    invitedBy: req.userId,
    status: 'active',
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    action: 'member_invited',
    entityType: 'membership',
    entityId: newMembership._id,
    newState: { email: user.email, role: role || 'executor' },
  });

  res.status(201).json({
    membership: {
      id: newMembership._id,
      user: {
        id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
      },
      role: newMembership.role,
    },
  });
}));

// Update member role
router.patch('/:organizationId/members/:memberId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, memberId } = req.params;
  const { role, status } = req.body;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'update', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const member = await Membership.findById(memberId);
  if (!member || member.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Prevent downgrading owner
  if (member.role === 'owner' && role !== 'owner') {
    return res.status(400).json({ error: 'Cannot downgrade owner' });
  }

  if (role) member.role = role;
  if (status) member.status = status;
  await member.save();

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    action: 'member_updated',
    entityType: 'membership',
    entityId: member._id,
    newState: { role: member.role, status: member.status },
  });

  res.json({ membership: member.toJSON() });
}));

// Remove member
router.delete('/:organizationId/members/:memberId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, memberId } = req.params;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'delete', 'member')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const member = await Membership.findById(memberId);
  if (!member || member.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Member not found' });
  }

  // Prevent removing owner
  if (member.role === 'owner') {
    return res.status(400).json({ error: 'Cannot remove owner' });
  }

  member.status = 'removed';
  await member.save();

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    action: 'member_removed',
    entityType: 'membership',
    entityId: member._id,
  });

  res.json({ message: 'Member removed successfully' });
}));

// Get organization analytics
router.get('/:organizationId/analytics', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get contract stats
  const [
    totalContracts,
    activeContracts,
    pendingReview,
    overdue,
    completedThisMonth,
  ] = await Promise.all([
    Contract.countDocuments({ organization: organizationId, isDeleted: false }),
    Contract.countDocuments({ organization: organizationId, currentStatus: { $in: ['accepted', 'in_progress'] }, isDeleted: false }),
    Contract.countDocuments({ organization: organizationId, currentStatus: 'submitted', isDeleted: false }),
    Contract.countDocuments({ 
      organization: organizationId, 
      currentDeadline: { $lt: new Date() },
      currentStatus: { $nin: ['approved', 'rejected', 'archived'] },
      isDeleted: false,
    }),
    Contract.countDocuments({
      organization: organizationId,
      currentStatus: 'approved',
      approvedAt: { $gte: new Date(new Date().setDate(1)) },
      isDeleted: false,
    }),
  ]);

  // Get completion rate
  const completedContracts = await Contract.countDocuments({
    organization: organizationId,
    currentStatus: 'approved',
    isDeleted: false,
  });
  const completionRate = totalContracts > 0 ? Math.round((completedContracts / totalContracts) * 100) : 0;

  // Get contracts by status
  const contractsByStatus = await Contract.aggregate([
    { $match: { organization: require('mongoose').Types.ObjectId(organizationId), isDeleted: false } },
    { $group: { _id: '$currentStatus', count: { $sum: 1 } } },
  ]);

  // Get recent activity
  const recentContracts = await Contract.find({ organization: organizationId, isDeleted: false })
    .sort({ updatedAt: -1 })
    .limit(5)
    .select('title contractNumber currentStatus updatedAt')
    .lean();

  res.json({
    stats: {
      totalContracts,
      activeContracts,
      pendingReview,
      overdue,
      completedThisMonth,
      completionRate,
    },
    contractsByStatus: contractsByStatus.reduce((acc, s) => {
      acc[s._id] = s.count;
      return acc;
    }, {}),
    recentContracts,
  });
}));

export default router;
