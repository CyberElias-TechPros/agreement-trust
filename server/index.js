import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config from './config/index.js';

// Import routes
import authRoutes from './routes/auth.js';
import organizationRoutes from './routes/organizations.js';
import contractRoutes from './routes/contracts.js';
import interactionRoutes from './routes/interactions.js';
import notificationRoutes from './routes/notifications.js';
import categoryRoutes from './routes/categories.js';
import userRoutes from './routes/users.js';

// Import middleware
import { errorHandler, notFound } from './middleware/errorHandler.js';
import { authenticate } from './middleware/auth.js';

const app = express();

// Middleware
app.use(cors({
  origin: config.corsOrigin,
  credentials: true,
}));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Request logging
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} ${req.method} ${req.path}`);
  next();
});

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authRoutes);
app.use('/api/v1/organizations', authenticate, organizationRoutes);
app.use('/api/v1/organizations/:organizationId/contracts', authenticate, contractRoutes);
app.use('/api/v1', authenticate, interactionRoutes);
app.use('/api/v1/notifications', authenticate, notificationRoutes);
app.use('/api/v1/organizations/:organizationId/categories', authenticate, categoryRoutes);
app.use('/api/v1/organizations/:organizationId/users', authenticate, userRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB and start server
const startServer = async () => {
  try {
    await mongoose.connect(config.mongoUri);
    console.log('Connected to MongoDB');

    app.listen(config.port, () => {
      console.log(`Server running on port ${config.port}`);
      console.log(`Health check: http://localhost:${config.port}/health`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

export default app;
