import express from 'express';
import * as ctrl from '../controllers/stripe-webhooks.js';

const r = express.Router();

// Stripe webhook routes (no authentication required)
r.post('/', ctrl.handleStripeWebhook);

export default r;
