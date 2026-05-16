const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const securityMiddleware = (app) => {
  // Helmet — secure HTTP headers + CSP
  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", "data:", "blob:"],
        connectSrc: ["'self'", process.env.SUPABASE_URL],
      }
    },
    crossOriginEmbedderPolicy: false
  }));

  // CORS
  app.use(cors({
    origin: process.env.NODE_ENV === 'production' 
      ? 'https://your-domain.com' 
      : 'http://localhost:5173',
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE'],
    allowedHeaders: ['Content-Type', 'Authorization']
  }));
};

// Rate limiters
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10,
  message: { error: 'Too many attempts. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});

const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: 100,
  message: { error: 'Rate limit exceeded.' }
});

module.exports = { securityMiddleware, authLimiter, apiLimiter };
