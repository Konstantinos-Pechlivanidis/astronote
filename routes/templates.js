import express from 'express';
import * as ctrl from '../controllers/templates.js';

const r = express.Router();

// Public template routes (no authentication required)
r.get('/', ctrl.getAllTemplates);
r.get('/categories', ctrl.getTemplateCategories);
r.get('/:id', ctrl.getTemplateById);

// Template usage tracking (requires shop context)
// Note: trackTemplateUsage handles store context internally with fallback
r.post('/:id/track', ctrl.trackTemplateUsage);

export default r;
