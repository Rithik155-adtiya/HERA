import express from 'express';
import { createServer } from 'http';
import mongoose from 'mongoose';
import { Server } from 'socket.io';
import cors from 'cors';
import helmet from 'helmet';
import morgan from 'morgan';
import rateLimit from 'express-rate-limit';
import { config } from './config/env';
import { connectDatabase } from './config/database';
import { logger } from './utils/logger';
import { errorHandler, notFound } from './middleware/errorHandler';
import { setSocketIO } from './services/notification/notificationService';
import { complaintService } from './services/complaint/complaintService';

// Routes
import authRoutes from './routes/auth';
import complaintRoutes from './routes/complaints';
import dashboardRoutes from './routes/dashboard';
import notificationRoutes from './routes/notifications';
import analyticsRoutes from './routes/analytics';
import configRoutes from './routes/config';

const app = express();
const httpServer = createServer(app);

// Socket.IO setup
const io = new Server(httpServer, {
  cors: {
    origin: config.CLIENT_URL,
    methods: ['GET', 'POST'],
  },
});

setSocketIO(io);

// Socket authentication
io.use(async (socket, next) => {
  const token = socket.handshake.auth.token;
  if (!token) {
    return next(new Error('Authentication required'));
  }
  try {
    const jwt = await import('jsonwebtoken');
    const decoded = jwt.default.verify(token, config.JWT_SECRET) as { id: string };
    socket.data.userId = decoded.id;
    next();
  } catch {
    next(new Error('Invalid token'));
  }
});

io.on('connection', (socket) => {
  const userId = socket.data.userId;
  if (userId) {
    socket.join(`user:${userId}`);
    logger.info(`Socket connected: user ${userId}`);
  }

  socket.on('disconnect', () => {
    logger.info(`Socket disconnected: user ${userId}`);
  });
});

// Security middleware
app.use(helmet({
  crossOriginEmbedderPolicy: false,
}));

// CORS
app.use(cors({
  origin: config.CLIENT_URL.split(',').map(url => url.trim()),
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
}));

// General rate limiting
const generalLimiter = rateLimit({
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  max: config.RATE_LIMIT_MAX_REQUESTS,
  message: { success: false, message: 'Too many requests. Please try again later.', code: 'RATE_LIMITED' },
});
app.use('/api/', generalLimiter);

// Logging
if (config.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (message) => logger.info(message.trim()) },
  }));
}

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Health check
app.get('/api/health', async (_req, res) => {
  const mongoStatus = mongoose.connection.readyState;
  const mongoStatusText = ['disconnected', 'connected', 'connecting', 'disconnecting'][mongoStatus];
  
  res.json({
    success: true,
    data: {
      status: 'ok',
      environment: config.NODE_ENV,
      database: mongoStatusText,
      aiEnabled: !!config.GEMINI_API_KEY,
      timestamp: new Date().toISOString(),
    },
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/complaints', complaintRoutes);
app.use('/api/dashboard', dashboardRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/analytics', analyticsRoutes);
app.use('/api', configRoutes);

// 404 and error handlers
app.use(notFound);
app.use(errorHandler);

// Start server only when executed directly (not when imported by tests)
async function startServer(): Promise<void> {
  try {
    await connectDatabase();

    httpServer.listen(config.PORT, () => {
      logger.info(`🚀 HERA Server running on port ${config.PORT} (${config.NODE_ENV})`);
    });

    // Schedule escalation check every 30 minutes
    const ESCALATION_INTERVAL = 30 * 60 * 1000;
    setInterval(async () => {
      try {
        await complaintService.runEscalationCheck();
      } catch (error) {
        logger.error('Escalation check failed:', error);
      }
    }, ESCALATION_INTERVAL);

  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
}

if (require.main === module) {
  void startServer();
}

export { app, httpServer };
