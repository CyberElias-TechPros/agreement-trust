import 'dotenv/config';
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
import { securityHeaders } from './middleware/security.js';
import { authLimiter, apiLimiter } from './middleware/rateLimit.js';

const app = express();

// Disable the default Express banner — it leaks the framework version.
app.disable('x-powered-by');
app.set('trust proxy', 1);

// Middleware
app.use(securityHeaders);
app.use(
  cors({
    origin: (origin, callback) => {
      // Same-origin requests and tooling without an Origin header are fine.
      if (!origin || config.corsOrigins.includes(origin)) {
        return callback(null, true);
      }
      return callback(new Error(`Origin ${origin} is not allowed by CORS`));
    },
    credentials: true,
  })
);
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Request logging (structured, no secrets)
app.use((req, res, next) => {
  console.log(JSON.stringify({ ts: new Date().toISOString(), method: req.method, path: req.path, ip: req.ip }));
  next();
});

// Health check
app.get('/health', (req, res) => {
  const dbState = mongoose.connection.readyState === 1 ? 'connected' : 'disconnected';
  res.json({ status: 'ok', database: dbState, timestamp: new Date().toISOString() });
});

// API Routes
app.use('/api/v1/auth', authLimiter, authRoutes);
app.use('/api/v1/organizations', apiLimiter, authenticate, organizationRoutes);
app.use('/api/v1/organizations/:organizationId/contracts', apiLimiter, authenticate, contractRoutes);
app.use('/api/v1', apiLimiter, authenticate, interactionRoutes);
app.use('/api/v1/notifications', apiLimiter, authenticate, notificationRoutes);
app.use('/api/v1/organizations/:organizationId/categories', apiLimiter, authenticate, categoryRoutes);
app.use('/api/v1/organizations/:organizationId/users', apiLimiter, authenticate, userRoutes);

// Error handling
app.use(notFound);
app.use(errorHandler);

// Connect to MongoDB, then start serving.
const connectWithRetry = async () => {
  const maxAttempts = 5;
  let connected = false;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      console.log(`[db] Connecting to MongoDB (attempt ${attempt}/${maxAttempts})…`);
      await mongoose.connect(config.mongoUri, { serverSelectionTimeoutMS: 8000 });
      connected = true;
      console.log('[db] Connected to MongoDB');
      break;
    } catch (error) {
      console.error(`[db] Connection failed (attempt ${attempt}):`, error.message);
      if (attempt < maxAttempts) {
        await new Promise((resolve) => setTimeout(resolve, 2000 * attempt));
      }
    }
  }

  if (!connected) {
    console.error('[db] Could not connect to MongoDB after all attempts.');
  }

  const port = config.port;
  app.listen(port, () => {
    console.log(`[server] Running on port ${port} (${config.nodeEnv})`);
    console.log(`[server] Health check: http://localhost:${port}/health`);
    if (!connected) {
      console.warn('[server] Serving without a database — API requests that need storage will fail.');
    }
  });
};

connectWithRetry();

export default app;
