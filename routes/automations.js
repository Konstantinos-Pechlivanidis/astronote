import express from 'express';
import * as ctrl from '../controllers/automations.js';

const r = express.Router();

// User automation routes (requires shop context)
r.get('/', ctrl.getUserAutomations);
r.post('/', ctrl.createUserAutomation); // Create new automation
r.get('/stats', ctrl.getAutomationStats);
r.put('/:id', ctrl.updateUserAutomation);
r.delete('/:id', ctrl.deleteUserAutomation); // Delete automation

// Admin routes (system defaults)
r.get('/defaults', ctrl.getSystemDefaults);
r.post('/sync', ctrl.syncSystemDefaults);

export default r;
