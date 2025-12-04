import express from 'express';
import * as ctrl from '../controllers/admin-templates.js';

const r = express.Router();

// Admin template management routes
r.get('/', ctrl.getAllTemplatesAdmin);
r.post('/', ctrl.createTemplate);
r.get('/:id/stats', ctrl.getTemplateStats);
r.put('/:id', ctrl.updateTemplate);
r.delete('/:id', ctrl.deleteTemplate);

export default r;
