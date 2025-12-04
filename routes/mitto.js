import { Router } from 'express';
import * as ctrl from '../controllers/mitto.js';
const r = Router();
// Adjust paths to match Mitto webhook config
r.post('/webhooks/mitto/dlr', ctrl.deliveryReport);
r.post('/webhooks/mitto/inbound', ctrl.inboundMessage);
export default r;
