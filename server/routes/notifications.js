import express from 'express';
import { Notification } from '../models/index.js';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';
import { isId } from '../utils/validate.js';

const clampInt = (value, fallback, min, max) => {
  const n = Number.parseInt(String(value ?? fallback), 10);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(Math.max(n, min), max);
};

const router = express.Router();

// Get user's notifications
router.get('/', authenticate, asyncHandler(async (req, res) => {
  const { unreadOnly } = req.query;
  const limit = clampInt(req.query.limit, 20, 1, 100);
  const offset = clampInt(req.query.offset, 0, 0, 100000);

  const query = { user: req.userId };
  if (unreadOnly === 'true') {
    query.inAppReadAt = null;
  }

  const [notifications, total, unreadCount] = await Promise.all([
    Notification.find(query)
      .sort({ createdAt: -1 })
      .skip(offset)
      .limit(limit)
      .populate('contract', 'title contractNumber')
      .lean(),
    Notification.countDocuments(query),
    Notification.countDocuments({ user: req.userId, inAppReadAt: null }),
  ]);

  res.json({
    notifications,
    unreadCount,
    pagination: {
      limit,
      offset,
      total,
    },
  });
}));

// Mark notification as read
router.patch('/:notificationId/read', authenticate, asyncHandler(async (req, res) => {
  const { notificationId } = req.params;

  if (!isId(notificationId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid notificationId'] });
  }

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

  if (!isId(notificationId)) {
    return res.status(400).json({ error: 'Validation failed', details: ['Invalid notificationId'] });
  }

  await Notification.findOneAndDelete({ _id: notificationId, user: req.userId });

  res.json({ message: 'Notification deleted' });
}));

// Get unread count
router.get('/unread-count', authenticate, asyncHandler(async (req, res) => {
  const count = await Notification.countDocuments({ user: req.userId, inAppReadAt: null });
  res.json({ count });
}));

export default router;
