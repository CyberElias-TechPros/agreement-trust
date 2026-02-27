import express from 'express';
import { User, Organization, Membership, AuditLog } from '../models/index.js';
import { generateTokens, verifyToken, authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../middleware/errorHandler.js';

const router = express.Router();

// Register new user
router.post('/register', asyncHandler(async (req, res) => {
  const { email, password, firstName, lastName } = req.body;

  // Check if user exists
  const existingUser = await User.findOne({ email: email.toLowerCase() });
  if (existingUser) {
    return res.status(400).json({ error: 'Email already registered' });
  }

  // Create user
  const user = new User({
    email: email.toLowerCase(),
    password,
    firstName,
    lastName,
  });

  await user.save();

  // Generate tokens
  const tokens = generateTokens(user._id);
  
  // Update last login
  user.lastLoginAt = new Date();
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();

  // Create default organization
  const org = new Organization({
    name: `${firstName}'s Organization`,
    slug: `${firstName.toLowerCase()}${lastName.toLowerCase()}-${Date.now()}`,
    owner: user._id,
  });
  await org.save();

  // Create owner membership
  await Membership.create({
    organization: org._id,
    user: user._id,
    role: 'owner',
    status: 'active',
  });

  // Log audit
  await AuditLog.create({
    user: user._id,
    organization: org._id,
    action: 'user_registered',
    entityType: 'user',
    entityId: user._id,
    newState: { email: user.email, firstName, lastName },
  });

  res.status(201).json({
    user: user.toJSON(),
    organization: org.toJSON(),
    ...tokens,
  });
}));

// Login
router.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email: email.toLowerCase() });
  if (!user) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  const isMatch = await user.comparePassword(password);
  if (!isMatch) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate tokens
  const tokens = generateTokens(user._id);

  // Update last login and store refresh token
  user.lastLoginAt = new Date();
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  // Keep only last 5 refresh tokens
  user.refreshTokens = user.refreshTokens.slice(-5);
  await user.save();

  // Get user's organizations
  const memberships = await Membership.find({ user: user._id, status: 'active' })
    .populate('organization')
    .lean();
  
  const organizations = memberships.map(m => ({
    ...m.organization,
    role: m.role,
  }));

  // Log audit
  await AuditLog.create({
    user: user._id,
    organization: organizations[0]?._id,
    action: 'user_login',
    entityType: 'user',
    entityId: user._id,
    ipAddress: req.ip,
    userAgent: req.get('User-Agent'),
  });

  res.json({
    user: user.toJSON(),
    organizations,
    ...tokens,
  });
}));

// Refresh token
router.post('/refresh', asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (!refreshToken) {
    return res.status(400).json({ error: 'Refresh token required' });
  }

  const decoded = verifyToken(refreshToken);
  if (!decoded || decoded.type !== 'refresh') {
    return res.status(401).json({ error: 'Invalid refresh token' });
  }

  const user = await User.findById(decoded.userId);
  if (!user) {
    return res.status(401).json({ error: 'User not found' });
  }

  // Check if refresh token exists and is valid
  const tokenExists = user.refreshTokens.some(
    t => t.token === refreshToken && new Date(t.expiresAt) > new Date()
  );

  if (!tokenExists) {
    return res.status(401).json({ error: 'Invalid or expired refresh token' });
  }

  // Remove old refresh token
  user.refreshTokens = user.refreshTokens.filter(t => t.token !== refreshToken);

  // Generate new tokens
  const tokens = generateTokens(user._id);

  // Store new refresh token
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  user.refreshTokens = user.refreshTokens.slice(-5);
  await user.save();

  res.json(tokens);
}));

// Logout
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    req.user.refreshTokens = req.user.refreshTokens.filter(
      t => t.token !== refreshToken
    );
    await req.user.save();
  }

  await AuditLog.create({
    user: req.userId,
    action: 'user_logout',
    entityType: 'user',
    entityId: req.userId,
  });

  res.json({ message: 'Logged out successfully' });
}));

// Get current user
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  // Get user's organizations
  const memberships = await Membership.find({ user: req.userId, status: 'active' })
    .populate('organization')
    .lean();
  
  const organizations = memberships.map(m => ({
    ...m.organization,
    role: m.role,
  }));

  res.json({
    user: req.user.toJSON(),
    organizations,
  });
}));

// Update profile
router.patch('/me', authenticate, asyncHandler(async (req, res) => {
  const { firstName, lastName, avatarUrl } = req.body;
  
  const updates = {};
  if (firstName) updates.firstName = firstName;
  if (lastName) updates.lastName = lastName;
  if (avatarUrl !== undefined) updates.avatarUrl = avatarUrl;

  const user = await User.findByIdAndUpdate(
    req.userId,
    { $set: updates },
    { new: true, runValidators: true }
  );

  res.json({ user: user.toJSON() });
}));

// Change password
router.post('/change-password', authenticate, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  const user = await User.findById(req.userId);
  const isMatch = await user.comparePassword(currentPassword);
  
  if (!isMatch) {
    return res.status(400).json({ error: 'Current password is incorrect' });
  }

  user.password = newPassword;
  await user.save();

  // Invalidate all refresh tokens for security
  user.refreshTokens = [];
  await user.save();

  // Generate new tokens
  const tokens = generateTokens(user._id);
  user.refreshTokens.push({
    token: tokens.refreshToken,
    expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  });
  await user.save();

  await AuditLog.create({
    user: req.userId,
    action: 'password_changed',
    entityType: 'user',
    entityId: req.userId,
  });

  res.json({ message: 'Password changed successfully', ...tokens });
}));

export default router;
