require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/db');

// Import routes
const authRoutes = require('./routes/auth');
const attendanceRoutes = require('./routes/attendance');
const geofenceRoutes = require('./routes/geofences');
const logsRoutes = require('./routes/logs');
const usersRoutes = require('./routes/users');

const app = express();
const PORT = process.env.PORT || 5000;

// =====================
// Security Middleware
// =====================

// Helmet for HTTP security headers
app.use(helmet());

// CORS — allow multiple origins
const allowedOrigins = [
  'http://localhost:3000',  // Client app
  'http://localhost:3001',  // Admin panel
  process.env.CLIENT_URL,
  process.env.ADMIN_URL,
].filter(Boolean);

app.use(
  cors({
    origin: function (origin, callback) {
      // Allow requests with no origin (mobile apps, curl, etc.)
      if (!origin || allowedOrigins.indexOf(origin) !== -1 || process.env.NODE_ENV === 'development') {
        callback(null, true);
      } else {
        callback(new Error('Not allowed by CORS'));
      }
    },
    credentials: true,
  })
);

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 100, // Limit each IP to 100 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests. Please try again later.',
  },
});

// Stricter rate limit for check-in endpoint
const checkInLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  limit: 5, // 5 check-ins per minute per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many check-in attempts. Please wait a moment.',
  },
});

// Stricter rate limit for login endpoint (brute force protection)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  limit: 10, // 10 login attempts per 15 minutes per IP
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many login attempts. Please try again in 15 minutes.',
  },
});

app.use('/api/', limiter);
app.use('/api/attendance/checkin', checkInLimiter);
app.use('/api/auth/login', loginLimiter);

// =====================
// General Middleware
// =====================

// Request logging
if (process.env.NODE_ENV !== 'production') {
  app.use(morgan('dev'));
}

// Body parsing
app.use(express.json({ limit: '10kb' })); // Limit JSON body size
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// Trust proxy for rate limiting behind reverse proxies
app.set('trust proxy', 1);

// =====================
// API Routes
// =====================

app.use('/api/auth', authRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/geofences', geofenceRoutes);
app.use('/api/logs', logsRoutes);
app.use('/api/users', usersRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: 'Attendance Tracker API is running',
    timestamp: new Date().toISOString(),
  });
});

// =====================
// Error Handling
// =====================

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    message: `Route ${req.originalUrl} not found.`,
  });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);

  // Multer errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({
      success: false,
      message: 'File too large. Maximum size is 5MB.',
    });
  }

  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({
      success: false,
      message: 'Invalid token.',
    });
  }

  res.status(err.status || 500).json({
    success: false,
    message: process.env.NODE_ENV === 'production' 
      ? 'Internal server error.' 
      : err.message,
  });
});

// =====================
// Start Server
// =====================

/**
 * Auto-create default admin on startup (no seed script needed)
 */
const autoSeedAdmin = async () => {
  try {
    const User = require('./models/User');
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@company.com';
    const adminPassword = process.env.ADMIN_PASSWORD || 'Admin@123456';

    const existingAdmin = await User.findOne({ email: adminEmail.toLowerCase() });
    if (!existingAdmin) {
      await User.create({
        name: 'System Admin',
        email: adminEmail,
        password: adminPassword,
        role: 'admin',
      });
      console.log(`✅ Default admin created: ${adminEmail}`);
    } else {
      console.log(`ℹ️  Admin already exists: ${adminEmail}`);
    }
  } catch (err) {
    console.error('⚠️  Auto-seed admin warning:', err.message);
  }
};

const startServer = async () => {
  try {
    await connectDB();
    await autoSeedAdmin(); // Auto-create admin on every startup
    app.listen(PORT, () => {
      console.log(`\n🚀 Server running on port ${PORT}`);
      console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🌐 Environment: ${process.env.NODE_ENV || 'development'}\n`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
