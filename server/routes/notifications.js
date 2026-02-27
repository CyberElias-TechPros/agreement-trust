import express from 'express';
import { Notification } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { unreadOnly, limit = 20, offset = 0 } = req.query;

  const query = { user: req.userId };
  if (unreadOnly === 'true') {
    query.inAppReadAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(parseInt(offset))
      .limit(parseInt(limit))
      .populate('contract', 'title contractNumber')
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ user: req.userId, inAppReadAt: null }),
  ]);

  res.json({
    notifications,
    unreadCount,
    pagination: {
      limit: parseInt(limit),
      offset: parseInt(offset),
      total,
    },
  });
}));

// Mark notification as read
router.patch('/:notificationId/read', authenticate, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  const notification = await Notification.findOneAndUpdate(
    { _id: notificationId, user: req.userId },
    { $set: { inAppReadAt: new Date() } },
    { new: true }
  );

  if (!notification) {
    return res.status(404).json({ error: 'Notification not found' });
  }

  res.json({ notification });
}));

// Mark all as read
router.post('/read-all', authenticate, asyncHandler(async (req, res) => {
  await Notification.updateMany(
    { user: req.userId, inAppReadAt: null },
    { $set: { inAppReadAt: new Date() } }
  );

  res.json({ message: 'All notifications marked as read' });
}));

// Delete notification
router.delete('/:notificationId', authenticate, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  await Notification.findOneAndDelete({ _id: notificationId, user: req.userId });

  res.json({ message: 'Notification deleted' });
}));

// Get unread count
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.userId, inAppReadAt: null });
  res.json({ count });
}));

export default router;
