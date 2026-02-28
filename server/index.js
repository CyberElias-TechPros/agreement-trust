import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import mongoose from 'mongoose';
import config, { getMongoUri, setNextMongoUri } from './config/index.js';

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

// Connect to MongoDB with fallback
const connectWithRetry = async () => {
  let connected = false;
  let attempts = 0;
  const maxAttempts = 3;

  while (!connected && attempts < maxAttempts) {
    try {
      console.log(`Attempting MongoDB connection (attempt ${attempts + 1}/${maxAttempts})...`);
      console.log(`URI: ${getMongoUri().substring(0, 50)}...`);
      
      await mongoose.connect(getMongoUri());
      connected = true;
      console.log('Connected to MongoDB');
    } catch (error) {
      attempts++;
      console.error(`MongoDB connection failed (attempt ${attempts}):`, error.message);
      
      if (attempts < maxAttempts) {
        const hasMore = setNextMongoUri();
        if (!hasMore) {
          console.error('All MongoDB connection attempts failed');
          break;
        }
        // Wait before retrying
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }
  }

  if (!connected) {
    console.error('Failed to connect to MongoDB after all attempts');
  }

  // Start server regardless
  const port = config.port;
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    console.log(`Health check: http://localhost:${port}/health`);
  });
};

connectWithRetry();

export default app;
