import express from 'express';
import * as ctrl from '../controllers/shortLinks.js';
import rateLimit from 'express-rate-limit';

const r = express.Router();

/**
 * Short Link Redirect Route
 * Public endpoint (no authentication required)
 * Rate limited to prevent abuse
 */

// Apply rate limiting for redirect endpoint
// More lenient than auth endpoints but still protected
const redirectRateLimit = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 100, // 100 requests per minute per IP
  message: {
    error: 'Too many redirect requests, please try again later.',
    retryAfter: 60,
  },
  standardHeaders: true,
  legacyHeaders: false,
});

r.use(redirectRateLimit);

// GET /r/:token - Redirect to destination URL
r.get('/:token', ctrl.redirectShortLink);

export default r;

