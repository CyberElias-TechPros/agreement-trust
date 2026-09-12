import express from 'express';
import { Category } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isId, isOrgName, validateBody } from '../utils/validate.js';

const router = express.Router();

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

const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

// Get categories for organization
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const categories = await Category.find({ organization: organizationId })
    .sort({ name: 1 })
    .lean();

  res.json({ categories });
}));

// Create category
router.post('/', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { name, color, description } = req.body || {};

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  const errors = validateBody(
    { name },
    { name: (v) => isOrgName(v) && String(v).trim().length <= 60 }
  );
  if (errors.length > 0) {
    return res.status(400).json({ error: 'Validation failed', details: errors });
  }
  if (color !== undefined && color !== null && !HEX_COLOR.test(String(color))) {
    return res.status(400).json({ error: 'Validation failed', details: ['color must be a #RRGGBB hex value'] });
  }

  const category = new Category({
    organization: organizationId,
    name: String(name).trim(),
    color: color || '#3B82F6',
    description: typeof description === 'string' ? description.slice(0, 1000) : undefined,
  });

  await category.save();

  res.status(201).json({ category });
}));

// Update category
router.patch('/:categoryId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, categoryId } = req.params;
  const { name, color, description } = req.body || {};

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!isId(categoryId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid categoryId'] });
  }

  const patch = {};
  if (name !== undefined) {
    const errors = validateBody({ name }, { name: (v) => isOrgName(v) && String(v).trim().length <= 60 });
    if (errors.length > 0) {
      return res.status(400).json({ error: 'Validation failed', details: errors });
    }
    patch.name = String(name).trim();
  }
  if (color !== undefined) {
    if (!HEX_COLOR.test(String(color))) {
      return res.status(400).json({ error: 'Validation failed', details: ['color must be a #RRGGBB hex value'] });
    }
    patch.color = color;
  }
  if (description !== undefined) {
    patch.description = typeof description === 'string' ? description.slice(0, 1000) : null;
  }

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, organization: organizationId },
    { $set: patch },
    { new: true, runValidators: true }
  );

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json({ category });
}));

// Delete category
router.delete('/:categoryId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, categoryId } = req.params;

  if (!(await requireOrgMember(organizationId, req.userId))) {
    return res.status(403).json({ error: 'Access denied' });
  }

  if (!isId(categoryId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid categoryId'] });
  }

  await Category.findOneAndDelete({ _id: categoryId, organization: organizationId });

  res.json({ message: 'Category deleted' });
}));

export default router;
