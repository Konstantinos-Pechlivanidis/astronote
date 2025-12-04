import express from 'express';
import { body } from 'express-validator';
import * as ctrl from '../controllers/discounts.js';
import { handleValidation } from '../middlewares/validate.js';

const r = express.Router();

// Get available discount codes
r.get('/discounts', ctrl.getShopifyDiscounts);

// Get specific discount code
r.get('/discounts/:id', ctrl.getShopifyDiscount);

// Validate discount code for campaign use
r.post(
  '/discounts/validate',
  body('discountId').isString().notEmpty(),
  handleValidation,
  ctrl.validateDiscount,
);

export default r;
