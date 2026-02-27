import express from 'express';
import { Category } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get categories for organization
router.get('/:organizationId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;

  const categories = await Category.find({ organization: organizationId })
    .sort({ name: 1 })
    .lean();

  res.json({ categories });
}));

// Create category
router.post('/:organizationId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId } = req.params;
  const { name, color, description } = req.body;

  const category = new Category({
    organization: organizationId,
    name,
    color: color || '#3B82F6',
    description,
  });

  await category.save();

  res.status(201).json({ category });
}));

// Update category
router.patch('/:organizationId/:categoryId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, categoryId } = req.params;
  const { name, color, description } = req.body;

  const category = await Category.findOneAndUpdate(
    { _id: categoryId, organization: organizationId },
    { $set: { name, color, description } },
    { new: true, runValidators: true }
  );

  if (!category) {
    return res.status(404).json({ error: 'Category not found' });
  }

  res.json({ category });
}));

// Delete category
router.delete('/:organizationId/:categoryId', authenticate, asyncHandler(async (req, res) => {
  const { organizationId, categoryId } = req.params;

  await Category.findOneAndDelete({ _id: categoryId, organization: organizationId });

  res.json({ message: 'Category deleted' });
}));

export default router;
