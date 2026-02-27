import express from 'express';
import { Contract, ContractInteraction, ContractParticipant, Notification, AuditLog } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get interactions for a contract
router.get('/:organizationId/contracts/:contractId/interactions', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;
  const { type, limit = 50, offset = 0 } = req.query;

  const contract = await Contract.findById(contractId).lean();
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  const query = { contract: contractId };
  if (type) {
    query.interactionType = type;
  }

  const [interactions, total] = await Promise.all([
    ContractInteraction.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('author', 'firstName lastName email avatarUrl')
      .lean(),
    ContractInteraction.countDocuments(query),
  ]);

  res.json({
    interactions,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total,
    },
  });
}));

// Create interaction
router.post('/:organizationId/contracts/:contractId/interactions', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId } = req.params;
  const { 
    interactionType, 
    content, 
    structuredData, 
    progressPercentage, 
    attachments 
  } = req.body;

  const contract = await Contract.findById(contractId);
  if (!contract || contract.organization.toString() !== organizationId) {
    return res.status(404).json({ error: 'Contract not found' });
  }

  // Check if user is participant
  const participant = await ContractParticipant.findOne({
    contract: contractId,
    user: req.userId,
    status: { $in: ['pending', 'active'] },
  });

  if (!participant && contract.initiator.toString() !== req.userId.toString()) {
    return res.status(403).json({ error: 'Not a participant in this contract' });
  }

  // Validate interaction type based on status
  const allowedTypes = {
    draft: ['comment'],
    sent: ['clarification_request', 'comment'],
    accepted: ['progress_update', 'clarification_request', 'issue_report', 'comment'],
    in_progress: ['progress_update', 'clarification_request', 'issue_report', 'comment'],
    submitted: ['clarification_request', 'comment'],
    approved: ['comment'],
    rejected: ['comment'],
    archived: [],
  };

  if (!allowedTypes[contract.currentStatus]?.includes(interactionType)) {
    return res.status(400).json({ error: `Cannot create ${interactionType} in ${contract.currentStatus} status` });
  }

  // Create interaction
  const interaction = await ContractInteraction.create({
    contract: contractId,
    author: req.userId,
    interactionType,
    content,
    structuredData,
    progressPercentage,
    attachments: attachments || [],
  });

  // Auto-transition to in_progress on first progress update
  if (interactionType === 'progress_update' && contract.currentStatus === 'accepted') {
    contract.currentStatus = 'in_progress';
    await contract.save();

    interaction.statusChangeFrom = 'accepted';
    interaction.statusChangeTo = 'in_progress';
    await interaction.save();
  }

  // Create notifications
  const participants = await ContractParticipant.find({ contract: contractId })
    .populate('user')
    .lean();

  const notifyUsers = participants
    .filter(p => p.user._id.toString() !== req.userId.toString())
    .map(p => p.user._id);

  const notificationTypes = {
    progress_update: 'new_interaction',
    clarification_request: 'new_interaction',
    issue_report: 'new_interaction',
    comment: 'new_interaction',
  };

  if (notifyUsers.length > 0 && notificationTypes[interactionType]) {
    await Notification.insertMany(
      notifyUsers.map(userId => ({
        user: userId,
        organization: organizationId,
        type: notificationTypes[interactionType],
        title: `New ${interactionType.replace('_', ' ')} on "${contract.title}"`,
        content: content.substring(0, 100),
        contract: contract._id,
      }))
    );
  }

  // Log audit
  await AuditLog.create({
    user: req.userId,
    organization: organizationId,
    contract: contractId,
    action: 'interaction_created',
    entityType: 'interaction',
    entityId: interaction._id,
    newState: { type: interactionType },
  });

  await interaction.populate('author', 'firstName lastName email avatarUrl');

  res.status(201).json({ interaction });
}));

// Get single interaction
router.get('/:organizationId/contracts/:contractId/interactions/:interactionId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, contractId, interactionId } = req.params;

  const interaction = await ContractInteraction.findById(interactionId)
    .populate('author', 'firstName lastName email avatarUrl')
    .lean();

  if (!interaction || interaction.contract.toString() !== contractId) {
    return res.status(404).json({ error: 'Interaction not found' });
  }

  res.json({ interaction });
}));

export default router;
