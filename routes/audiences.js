import express from 'express';
import { query, body } from 'express-validator';
import * as ctrl from '../controllers/audiences.js';
import { handleValidation } from '../middlewares/validate.js';

const r = express.Router();

// Get predefined audiences
r.get('/', ctrl.getAudiences);

// Get audience details with contact list
r.get(
  '/:audienceId/details',
  query('page').optional().isInt({ min: 1 }),
  query('limit').optional().isInt({ min: 1, max: 100 }),
  handleValidation,
  ctrl.getAudienceDetails,
);

// Validate audience selection
r.post(
  '/validate',
  body('audienceId').isString().notEmpty(),
  handleValidation,
  ctrl.validateAudience,
);

export default r;
