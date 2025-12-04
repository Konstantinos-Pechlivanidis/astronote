import { Router } from 'express';
import * as ctrl from '../controllers/discounts.js';
const r = Router();
r.get('/', ctrl.getShopifyDiscounts);
r.get('/:id', ctrl.getShopifyDiscount);
r.get('/validate/:code', ctrl.validateDiscount);
export default r;
