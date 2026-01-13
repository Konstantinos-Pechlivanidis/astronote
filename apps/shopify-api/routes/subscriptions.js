import express from 'express';
import * as ctrl from '../controllers/subscriptions.js';
import { validateBody } from '../middlewares/validation.js';
import {
  subscriptionSubscribeSchema,
  subscriptionUpdateSchema,
  subscriptionSwitchSchema,
} from '../schemas/subscription.schema.js';

const r = express.Router();

// GET /subscriptions/status - Get subscription status
r.get('/status', ctrl.getStatus);

// POST /subscriptions/reconcile - Manual reconciliation against Stripe
r.post('/reconcile', ctrl.reconcile);

// POST /subscriptions/subscribe - Create subscription checkout
r.post('/subscribe', validateBody(subscriptionSubscribeSchema), ctrl.subscribe);

// POST /subscriptions/update - Update subscription plan
r.post('/update', validateBody(subscriptionUpdateSchema), ctrl.update);

// POST /subscriptions/switch - Switch subscription interval (monthly/yearly) or plan
r.post('/switch', validateBody(subscriptionSwitchSchema), ctrl.switchInterval);

// POST /subscriptions/cancel - Cancel subscription
r.post('/cancel', ctrl.cancel);

// POST /subscriptions/resume - Resume subscription (undo cancellation)
r.post('/resume', ctrl.resume);

// POST /subscriptions/verify-session - Manual verification
r.post('/verify-session', ctrl.verifySession);

// GET /subscriptions/portal - Get Stripe Customer Portal URL
r.get('/portal', ctrl.getPortal);

// POST /subscriptions/finalize - Finalize subscription from checkout session
r.post('/finalize', ctrl.finalize);

export default r;
