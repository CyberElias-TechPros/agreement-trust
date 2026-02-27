import jwt from 'jsonwebtoken';
import config from '../config/index.js';
import { User, Membership } from '../models/index.js';

// Generate tokens
export const generateTokens = (userId) => {
  const accessToken = jwt.sign({ userId }, config.jwtSecret, {
    expiresIn: config.jwtExpiresIn,
  });
  
  const refreshToken = jwt.sign({ userId, type: 'refresh' }, config.jwtSecret, {
    expiresIn: config.refreshTokenExpiresIn,
  });
  
  return { accessToken, refreshToken };
};

// Verify access token
export const verifyToken = (token) => {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    return null;
  }
};

// Auth middleware - require authentication
export const authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }
    
    const user = await User.findById(decoded.userId);
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }
    
    req.user = user;
    req.userId = user._id;
    next();
  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};

// Optional auth - populates user if token provided
export const optionalAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = verifyToken(token);
    
    if (decoded) {
      const user = await User.findById(decoded.userId);
      if (user) {
        req.user = user;
        req.userId = user._id;
      }
    }
    
    next();
  } catch (error) {
    next();
  }
};

// Role hierarchy for RBAC
const roleHierarchy = {
  owner: 5,
  admin: 4,
  manager: 3,
  executor: 2,
  observer: 1,
};

// Check if user has required role or higher
export const requireRole = (...allowedRoles) => {
  return async (req, res, next) => {
    try {
      const { organizationId } = req.params;
      
      if (!req.user) {
        return res.status(401).json({ error: 'Authentication required' });
      }
      
      // Super admin bypass (if implemented)
      if (req.user.isSuperAdmin) {
        return next();
      }
      
      if (!organizationId) {
        return next();
      }
      
      const membership = await Membership.findOne({
        user: req.userId,
        organization: organizationId,
        status: 'active',
      });
      
      if (!membership) {
        return res.status(403).json({ error: 'Access denied to this organization' });
      }
      
      const userRoleLevel = roleHierarchy[membership.role] || 0;
      const hasAllowedRole = allowedRoles.some(role => 
        userRoleLevel >= roleHierarchy[role]
      );
      
      if (!hasAllowedRole) {
        return res.status(403).json({ error: 'Insufficient permissions' });
      }
      
      req.membership = membership;
      req.organizationId = organizationId;
      next();
    } catch (error) {
      console.error('Role check error:', error);
      res.status(500).json({ error: 'Authorization failed' });
    }
  };
};

// Permission matrix helper
export const canPerformAction = (userRole, action, resource) => {
  const permissions = {
    owner: {
      contract: ['create', 'read', 'update', 'delete', 'send', 'accept', 'submit', 'approve', 'reject', 'archive'],
      member: ['create', 'read', 'update', 'delete'],
      organization: ['read', 'update', 'delete', 'manage_billing'],
      audit: ['read', 'export'],
    },
    admin: {
      contract: ['create', 'read', 'update', 'delete', 'send', 'accept', 'submit', 'approve', 'reject', 'archive'],
      member: ['create', 'read', 'update', 'delete'],
      organization: ['read', 'update'],
      audit: ['read', 'export'],
    },
    manager: {
      contract: ['create', 'read', 'update', 'send', 'accept', 'submit', 'approve', 'reject'],
      member: ['read'],
      organization: ['read'],
      audit: ['read'],
    },
    executor: {
      contract: ['read', 'accept', 'submit'],
      member: ['read'],
      organization: ['read'],
      audit: [],
    },
    observer: {
      contract: ['read'],
      member: ['read'],
      organization: ['read'],
      audit: [],
    },
  };
  
  return permissions[userRole]?.[resource]?.includes(action) || false;
};
