import { Router } from 'express';
import * as ctrl from '../controllers/dashboard.js';
const r = Router();
r.get('/', ctrl.dashboard); // Main dashboard endpoint
r.get('/overview', ctrl.overview);
r.get('/quick-stats', ctrl.quickStats);
export default r;
