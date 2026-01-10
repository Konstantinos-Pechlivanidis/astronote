import express from 'express';
import * as ctrl from '../controllers/templates.js';
import { resolveStore } from '../middlewares/store-resolution.js';

const r = express.Router();

// Template routes (tenant-scoped, requires authentication)
// All routes now require tenant context (aligned with Retail: ownerId concept)
r.get('/', resolveStore, ctrl.getAllTemplates);
r.get('/categories', resolveStore, ctrl.getTemplateCategories);
r.get('/:id', resolveStore, ctrl.getTemplateById);

// Ensure default templates endpoint (tenant-scoped)
r.post('/ensure-defaults', resolveStore, ctrl.ensureDefaultTemplates);

// Template usage tracking (requires shop context)
// Note: trackTemplateUsage handles store context internally with fallback
r.post('/:id/track', resolveStore, ctrl.trackTemplateUsage);

export default r;
