import { Router } from 'express';
import * as ctrl from '../controllers/debug.js';

const r = Router();

// All debug routes are store-scoped and require auth (resolveStore/requireStore applied at mount).
r.get('/queues', ctrl.getQueues);
r.get('/campaigns/:id', ctrl.getCampaignDebug);
r.get('/credits', ctrl.getCreditsDebug);

export default r;


