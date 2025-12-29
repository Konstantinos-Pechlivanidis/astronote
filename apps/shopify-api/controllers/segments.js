import { getStoreId } from '../middlewares/store-resolution.js';
import { logger } from '../utils/logger.js';
import segmentsService from '../services/segments.js';
import { sendSuccess } from '../utils/response.js';

/**
 * Get system segments for the current shop
 * GET /audiences/segments
 */
export async function getSegments(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const segments = await segmentsService.getSystemSegments(shopId);

    // Format for frontend
    const formatted = segments.map(seg => ({
      id: seg.id,
      key: seg.key,
      name: seg.name,
      type: seg.type,
      criteria: seg.criteriaJson || seg.ruleJson,
      isActive: seg.isActive,
      createdAt: seg.createdAt,
    }));

    return sendSuccess(res, {
      segments: formatted,
      total: formatted.length,
    });
  } catch (error) {
    logger.error('Error in getSegments', {
      error: error.message,
      stack: error.stack,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * Get segment by ID
 * GET /audiences/segments/:id
 */
export async function getSegmentById(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { id } = req.params;
    const segment = await segmentsService.getSegmentById(shopId, id);

    return sendSuccess(res, {
      id: segment.id,
      key: segment.key,
      name: segment.name,
      type: segment.type,
      criteria: segment.criteriaJson || segment.ruleJson,
      isActive: segment.isActive,
      createdAt: segment.createdAt,
    });
  } catch (error) {
    logger.error('Error in getSegmentById', {
      error: error.message,
      segmentId: req.params.id,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

/**
 * Get segment preview (estimated count)
 * GET /audiences/segments/:id/preview
 */
export async function getSegmentPreview(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { id } = req.params;
    const segment = await segmentsService.getSegmentById(shopId, id);
    const estimatedCount = await segmentsService.getSegmentEstimatedCount(shopId, segment);

    return sendSuccess(res, {
      segmentId: id,
      estimatedCount,
    });
  } catch (error) {
    logger.error('Error in getSegmentPreview', {
      error: error.message,
      segmentId: req.params.id,
      shopId: getStoreId(req),
    });
    next(error);
  }
}

