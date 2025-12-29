import express from 'express';
import * as ctrl from '../controllers/automations.js';
import { validateBody, validateParams } from '../middlewares/validation.js';
import {
  createAutomationSchema,
  updateAutomationSchema,
  automationVariablesSchema,
} from '../schemas/automations.schema.js';

const r = express.Router();

// User automation routes (requires shop context)
r.get('/', ctrl.getUserAutomations);
r.post(
  '/',
  validateBody(createAutomationSchema),
  ctrl.createUserAutomation,
); // Create new automation
r.get('/stats', ctrl.getAutomationStats);
r.get(
  '/variables/:triggerType',
  validateParams(automationVariablesSchema),
  ctrl.getAutomationVariables,
); // Get available variables for trigger type
r.put(
  '/:id',
  validateBody(updateAutomationSchema),
  ctrl.updateUserAutomation,
);
r.delete('/:id', ctrl.deleteUserAutomation); // Delete automation

// Admin routes (system defaults)
r.get('/defaults', ctrl.getSystemDefaults);
r.post('/sync', ctrl.syncSystemDefaults);

export default r;
