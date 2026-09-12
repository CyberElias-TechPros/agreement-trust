import express from 'express';
import mongoose from 'mongoose';
import { Contract, ContractVersion, ContractParticipant, ContractInteraction, Notification, AuditLog, Category, User } from '../models/index.js';
import { authenticate, canPerformAction } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isId } from '../utils/validate.js';

const router = express.Router();

// Get all contracts for organization
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { status, priority, search, assignee, page = 1, limit = 20 } = req.query;

  // Build query
  const query = { organization: organizationId, isDeleted: false };

  if (status) {
    query.currentStatus = Array.isArray(status) ? { $in: status } : status;
  }

  if (priority) {
    query.currentPriority = priority;
  }

  if (search) {
    query.$text = { $search: search };
  }

  // Get user's membership
  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Filter based on role
  if (membership.role === 'executor') {
    query.responsibleExecutor = req.userId;
  } else if (membership.role === 'observer') {
    query.responsibleExecutor = req.userId;
  }

  // For assignee filter
  if (assignee) {
    query.responsibleExecutor = assignee;
  }

  const skip = (parseInt(page) - 1) * parseInt(limit);

  const [contracts, total] = await Promise.all([
    Contract.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .populate('initiator', 'firstName lastName email avatarUrl')
      .populate('responsibleExecutor', 'firstName lastName email avatarUrl')
      .populate('category', 'name color')
      .lean(),
    Contract.countDocuments(query),
  ]);

  res.json({
    contracts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      pages: Math.ceil(total / parseInt(limit)),
    },
  });
}));

// Create contract
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { title, description, deadline, priority, categoryId, executorId, observerIds, tags, attachments } = req.body;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'create', 'contract')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  // Validation
  if (!title || typeof title !== 'string' || title.trim().length === 0) {
    return res.status(400).json({ error: 'Validation failed', details: ['title is required'] });
  }
  if (!description || typeof description !== 'string' || description.trim().length === 0) {
    return res.status(400).json({ error: 'Validation failed', details: ['description is required'] });
  }
  if (deadline && isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: 'Validation failed', details: ['deadline must be a valid date'] });
  }
  if (priority && !['low', 'medium', 'high', 'critical'].includes(priority)) {
    return res.status(400).json({ error: 'Validation failed', details: ['priority must be one of low, medium, high, critical'] });
  }
  if (observerIds !== undefined && (!Array.isArray(observerIds) || observerIds.some((id) => typeof id !== 'string'))) {
    return res.status(400).json({ error: 'Validation failed', details: ['observerIds must be an array of user ids'] });
  }

  // Observers must be active members of the organization
  const observerList = (observerIds || []).filter((id) => id !== executorId);
  if (observerList.length > 0) {
    const observerMemberships = await Membership.find({
      user: { $in: observerList },
      organization: organizationId,
      status: 'active',
    }).select('user');
    const validObserverIds = observerMemberships.map((m) => String(m.user));
    if (validObserverIds.length !== new Set(observerList).size) {
      return res.status(400).json({ error: 'Validation failed', details: ['every observer must be an active member of the organization'] });
    }
  }

  // Create contract
  const contract = new Contract({
    organization: organizationId,
    title,
    currentDescription: description,
    currentDeadline: deadline || null,
    currentPriority: priority || 'medium',
    currentStatus: 'draft',
    initiator: req.userId,
    responsibleExecutor: executorId || null,
    category: categoryId || null,
    tags: tags || [],
    attachments: attachments || [],
  });

  await contract.save();

  // Create initial version
  await ContractVersion.create({
    contract: contract._id,
    versionNumber: 1,
    description,
    deadline: deadline || null,
    priority: priority || 'medium',
    changedBy: req.userId,
    changeReason: 'Initial creation',
  });

  // Add participants
  const participants = [
    { contract: contract._id, user: req.userId, role: 'initiator', isLead: true, status: 'active', acceptedAt: new Date() },
  ];

  if (executorId) {
    participants.push({
      contract: contract._id,
      user: executorId,
      role: 'executor',
      isLead: true,
      status: 'pending',
    });
  }

  for (const observerId of observerList) {
    participants.push({
      contract: contract._id,
      user: observerId,
      role: 'observer',
      isLead: false,
      status: 'active',
    });
  }

  await ContractParticipant.insertMany(participants);

  // Log audit
  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_created',
    entityType: 'contract',
    entityId: contract._id,
    newState: { title, status: 'draft' },
  });

  // Populate and return
  await contract.populate('initiator', 'firstName lastName email avatarUrl');
  await contract.populate('responsibleExecutor', 'firstName lastName email avatarUrl');
  await contract.populate('category', 'name color');

  res.status(201).json({ contract });
}));

// Get single contract
router.get('/:contractId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const contract = await Contract.findById(contractId)
    .populate('initiator', 'firstName lastName email avatarUrl')
    .populate('responsibleExecutor', 'firstName lastName email avatarUrl')
    .populate('category', 'name color')
    .lean();

  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  // Check access for executors/observers
  if ((membership.role === 'executor' || membership.role === 'observer') && 
      contract.responsibleExecutor?.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: 'Access denied' });
  }

  // Get participants
  const participants = await ContractParticipant.find({ contract: contractId })
    .populate('user', 'firstName lastName email avatarUrl')
    .lean();

  // Get version history
  const versions = await ContractVersion.find({ contract: contractId })
    .sort({ versionNumber: -1 })
    .lean();

  // Get interactions
  const interactions = await ContractInteraction.find({ contract: contractId })
    .sort({ createdAt: -1 })
    .populate('author', 'firstName lastName email avatarUrl')
    .limit(50)
    .lean();

  // Log view
  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contractId,
    action: 'contract_viewed',
    entityType: 'contract',
    entityId: contractId,
  });

  res.json({
    contract,
    participants,
    versions,
    interactions,
  });
}));

// Update contract (creates new version)
router.patch('/:contractId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;
  const { title, description, deadline, priority, categoryId, tags, changeReason } = req.body || {};

  if (!isId(contractId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid contractId'] });
  }
  if (title !== undefined && (typeof title !== 'string' || title.trim().length === 0)) {
    return res.status(400).json({ error: 'Validation failed', details: ['title must be a non-empty string'] });
  }
  if (description !== undefined && (typeof description !== 'string' || description.trim().length === 0)) {
    return res.status(400).json({ error: 'Validation failed', details: ['description must be a non-empty string'] });
  }
  if (deadline !== undefined && deadline !== null && isNaN(Date.parse(deadline))) {
    return res.status(400).json({ error: 'Validation failed', details: ['deadline must be a valid date'] });
  }
  if (priority !== undefined && !['low', 'medium', 'high', 'critical'].includes(priority)) {
    return res.status(400).json({ error: 'Validation failed', details: ['priority must be one of low, medium, high, critical'] });
  }
  if (tags !== undefined && (!Array.isArray(tags) || tags.some((t) => typeof t !== 'string'))) {
    return res.status(400).json({ error: 'Validation failed', details: ['tags must be an array of strings'] });
  }
  if (changeReason !== undefined && (typeof changeReason !== 'string' || changeReason.length > 2000)) {
    return res.status(400).json({ error: 'Validation failed', details: ['changeReason must be a string of at most 2000 characters'] });
  }

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'update', 'contract')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  // Check if can edit (not in archived or approved)
  if (['archived', 'approved'].includes(contract.currentStatus)) {
    return res.status(400).json({ error: 'Cannot edit archived or approved contracts' });
  }

  // Store previous state for diff
  const previousState = {
    title: contract.title,
    description: contract.currentDescription,
    deadline: contract.currentDeadline,
    priority: contract.currentPriority,
  };

  // Update contract
  const newVersion = contract.currentVersion + 1;
  
  if (title) contract.title = title;
  if (description) contract.currentDescription = description;
  if (deadline !== undefined) contract.currentDeadline = deadline;
  if (priority) contract.currentPriority = priority;
  if (categoryId !== undefined) contract.category = categoryId;
  if (tags) contract.tags = tags;
  contract.currentVersion = newVersion;

  await contract.save();

  // Create new version record
  await ContractVersion.create({
    contract: contract._id,
    versionNumber: newVersion,
    description: description || contract.currentDescription,
    deadline: deadline !== undefined ? deadline : contract.currentDeadline,
    priority: priority || contract.currentPriority,
    changedBy: req.userId,
    changeReason: changeReason || 'Contract updated',
  });

  // Log audit
  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_updated',
    entityType: 'contract',
    entityId: contract._id,
    previousState,
    newState: { title: contract.title, version: newVersion },
  });

  // Notify participants
  if (executorId && executorId !== req.userId.toString()) {
    await Notification.create({
      user: executorId,
      organization: organizationId,
      type: 'version_updated',
      title: `Contract "${contract.title}" has been updated`,
      content: `A new version (v${newVersion}) has been created.`,
      contract: contract._id,
    });
  }

  await contract.populate('initiator', 'firstName lastName email avatarUrl');
  await contract.populate('responsibleExecutor', 'firstName lastName email avatarUrl');
  await contract.populate('category', 'name color');

  res.json({ contract });
}));

// Send contract to executor
router.post('/:contractId/send', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'send', 'contract')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (contract.currentStatus !== 'draft') {
    return res.status(400).json({ error: 'Contract is not in draft status' });
  }

  if (!contract.responsibleExecutor) {
    return res.status(400).json({ error: 'No executor assigned' });
  }

  // Update status
  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'sent';
  contract.sentAt = new Date();
  await contract.save();

  // Update participant
  await ContractParticipant.findOneAndUpdate(
    { contract: contractId, user: contract.responsibleExecutor },
    { status: 'pending' }
  );

  // Create interaction
  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'comment',
    content: 'Contract sent to executor for acceptance.',
    statusChangeFrom: previousStatus,
    statusChangeTo: 'sent',
  });

  // Notify executor
  await Notification.create({
    user: contract.responsibleExecutor,
    organization: organizationId,
    type: 'contract_sent',
    title: `New contract assigned: "${contract.title}"`,
    content: 'Please review and accept this contract.',
    contract: contract._id,
  });

  // Log audit
  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_sent',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'sent' },
  });

  res.json({ contract });
}));

// Accept contract
router.post('/:contractId/accept', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (contract.currentStatus !== 'sent') {
    return res.status(400).json({ error: 'Contract is not in sent status' });
  }

  if (contract.responsibleExecutor?.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: 'Only the assigned executor can accept' });
  }

  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'accepted';
  contract.acceptedAt = new Date();
  await contract.save();

  // Update participant
  await ContractParticipant.findOneAndUpdate(
    { contract: contractId, user: req.userId },
    { status: 'active', acceptedAt: new Date() }
  );

  // Create interaction
  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'comment',
    content: 'Contract accepted.',
    statusChangeFrom: previousStatus,
    statusChangeTo: 'accepted',
  });

  // Notify initiator
  await Notification.create({
    user: contract.initiator,
    organization: organizationId,
    type: 'contract_accepted',
    title: `Contract accepted: "${contract.title}"`,
    content: 'The executor has accepted the contract.',
    contract: contract._id,
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_accepted',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'accepted' },
  });

  res.json({ contract });
}));

// Reject/decline contract
router.post('/:contractId/reject', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;
  const { reason } = req.body;

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (!['sent', 'submitted'].includes(contract.currentStatus)) {
    return res.status(400).json({ error: 'Contract cannot be rejected in current status' });
  }

  if (contract.responsibleExecutor?.toString() !== req.userId.toString() && 
      contract.initiator.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: 'Not authorized' });
  }

  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'rejected';
  await contract.save();

  // Create interaction
  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'rejection',
    content: reason || 'Contract declined.',
    statusChangeFrom: previousStatus,
    statusChangeTo: 'rejected',
  });

  // Notify relevant party
  const notifyUser = previousStatus === 'sent' ? contract.initiator : contract.responsibleExecutor;
  await Notification.create({
    user: notifyUser,
    organization: organizationId,
    type: 'contract_rejected',
    title: `Contract rejected: "${contract.title}"`,
    content: reason || 'The contract has been rejected.',
    contract: contract._id,
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_rejected',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'rejected' },
  });

  res.json({ contract });
}));

// Submit contract for review
router.post('/:contractId/submit', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;
  const { summary, attachments } = req.body;

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (contract.currentStatus !== 'accepted' && contract.currentStatus !== 'in_progress') {
    return res.status(400).json({ error: 'Contract must be accepted before submitting' });
  }

  if (contract.responsibleExecutor?.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: 'Only the executor can submit' });
  }

  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'submitted';
  contract.completedAt = new Date();
  await contract.save();

  // Create submission interaction
  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'submission',
    content: summary || 'Work completed and submitted for review.',
    attachments: attachments || [],
    statusChangeFrom: previousStatus,
    statusChangeTo: 'submitted',
  });

  // Notify initiator
  await Notification.create({
    user: contract.initiator,
    organization: organizationId,
    type: 'contract_submitted',
    title: `Contract submitted for review: "${contract.title}"`,
    content: 'Please review and approve or reject.',
    contract: contract._id,
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_submitted',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'submitted' },
  });

  res.json({ contract });
}));

// Approve contract
router.post('/:contractId/approve', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'approve', 'contract')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  if (contract.currentStatus !== 'submitted') {
    return res.status(400).json({ error: 'Contract is not submitted for review' });
  }

  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'approved';
  contract.approvedAt = new Date();
  await contract.save();

  // Create approval interaction
  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'approval',
    content: 'Contract approved.',
    statusChangeFrom: previousStatus,
    statusChangeTo: 'approved',
  });

  // Notify executor
  await Notification.create({
    user: contract.responsibleExecutor,
    organization: organizationId,
    type: 'contract_approved',
    title: `Contract approved: "${contract.title}"`,
    content: 'Congratulations! The contract has been approved.',
    contract: contract._id,
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_approved',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'approved' },
  });

  res.json({ contract });
}));

// Archive contract
router.post('/:contractId/archive', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'archive', 'contract')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  const previousStatus = contract.currentStatus;
  contract.currentStatus = 'archived';
  contract.archivedAt = new Date();
  await contract.save();

  await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType: 'system_note',
    content: 'Contract archived.',
    statusChangeFrom: previousStatus,
    statusChangeTo: 'archived',
  });

  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contract._id,
    action: 'contract_archived',
    entityType: 'contract',
    entityId: contract._id,
    previousState: { status: previousStatus },
    newState: { status: 'archived' },
  });

  res.json({ contract });
}));

// Get contract history/versions
router.get('/:contractId/history', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const contract = await Contract.findById(contractId).lean();
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  const versions = await ContractVersion.find({ contract: contractId })
    .sort({ versionNumber: -1 })
    .populate('changedBy', 'firstName lastName email avatarUrl')
    .lean();

  res.json({ versions });
}));

// Get contract audit log
router.get('/:contractId/audit', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;

  const { Membership } = await import('../models/index.js');
  const membership = await Membership.findOne({
    user: req.userId,
    organization: organizationId,
    status: 'active',
  });

  if (!membership || !canPerformAction(membership.role, 'read', 'audit')) {
    return res.status(403).json({ error: 'Insufficient permissions' });
  }

  const auditLogs = await AuditLog.find({ contract: contractId })
    .sort({ createdAt: -1 })
    .populate('user', 'firstName lastName email avatarUrl')
    .lean();

  res.json({ auditLogs });
}));

export default router;
