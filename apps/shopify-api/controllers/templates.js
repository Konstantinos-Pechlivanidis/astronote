import prisma from '../services/prisma.js';
import { logger } from '../utils/logger.js';
import { getStoreId } from '../middlewares/store-resolution.js';
import { sendSuccess } from '../utils/response.js';
import { NotFoundError, ValidationError } from '../utils/errors.js';
import * as templatesService from '../services/templates.js';

/**
 * Get all templates with optional filters (tenant-scoped and eShop type-scoped)
 * Aligned with Retail: GET /templates with tenant scoping
 */
export async function getAllTemplates(req, res, next) {
  try {
    // Get storeId (required for tenant scoping)
    const shopId = getStoreId(req);

    // Get filters
    const {
      eshopType, // Required or derived from shop settings
      category,
      search,
      language = 'en', // Default to English (aligned with Retail)
      page,
      pageSize,
      limit, // Backward compatibility
      offset, // Backward compatibility
    } = req.query;

    // Validate language parameter (ENGLISH-ONLY for Shopify)
    // Shopify templates are English-only, so only 'en' is allowed
    if (language && language !== 'en') {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'Shopify templates are English-only. Language parameter must be "en" or omitted.',
      });
    }
    // Force English-only
    const effectiveLanguage = 'en';

    // Call service with tenant scoping
    const result = await templatesService.listTemplates(shopId, {
      eshopType,
      category,
      search,
      language: effectiveLanguage, // Force English-only
      page: page ? parseInt(page) : undefined,
      pageSize: pageSize ? parseInt(pageSize) : undefined,
      limit: limit ? parseInt(limit) : undefined,
      offset: offset ? parseInt(offset) : undefined,
    });

    // Get usage counts for each template
    const templateIds = result.items.map(t => t.id);
    const usages = await prisma.templateUsage.findMany({
      where: {
        shopId,
        templateId: { in: templateIds },
      },
      select: {
        templateId: true,
        usedCount: true,
      },
    });
    const usageCounts = {};
    usages.forEach(usage => {
      usageCounts[usage.templateId] = usage.usedCount;
    });

    // Add usage counts to templates
    const templatesWithUsage = result.items.map(template => ({
      ...template,
      useCount: usageCounts[template.id] || 0,
    }));

    // Return Retail-aligned shape: { items, total, page, pageSize }
    // Also include templates and pagination for backward compatibility
    return res.json({
      items: templatesWithUsage, // Retail-aligned field name
      templates: templatesWithUsage, // Backward compatibility
      total: result.total,
      page: result.page,
      pageSize: result.pageSize,
      pagination: result.pagination, // Backward compatibility
      categories: result.categories,
    });
  } catch (error) {
    logger.error('Failed to fetch templates', {
      error: error.message,
      stack: error.stack,
      query: req.query,
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    next(error);
  }
}

/**
 * Get a single template by ID (tenant-scoped)
 * Aligned with Retail: GET /templates/:id with tenant scoping
 */
export async function getTemplateById(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { id } = req.params;

    const template = await templatesService.getTemplateById(shopId, id);

    return sendSuccess(res, template);
  } catch (error) {
    logger.error('Failed to fetch template', {
      error: error.message,
      stack: error.stack,
      templateId: req.params.id,
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    next(error);
  }
}

/**
 * Get template categories (tenant-scoped and eShop type-scoped)
 */
export async function getTemplateCategories(req, res, next) {
  try {
    const shopId = getStoreId(req);

    // Return store-type categories from global templates
    // Categories are now store-type names (Fashion & Apparel, Beauty & Cosmetics, etc.)
    const categories = await prisma.template.findMany({
      where: {
        OR: [
          { shopId: null, isPublic: true }, // Global templates
          { shopId }, // Shop-specific templates
        ],
      },
      select: { category: true },
      distinct: ['category'],
      orderBy: { category: 'asc' },
    });

    // Sanitize categories: filter out null/empty and ensure non-empty strings
    const sanitizedCategories = categories
      .map(c => String(c?.category ?? '').trim())
      .filter(cat => cat !== '')
      .filter((cat, index, arr) => arr.indexOf(cat) === index) // Remove duplicates
      .sort(); // Sort by display order (store-type categories should be in a sensible order)

    return sendSuccess(
      res,
      sanitizedCategories,
    );
  } catch (error) {
    logger.error('Failed to fetch template categories', {
      error: error.message,
      stack: error.stack,
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    next(error);
  }
}

/**
 * Track template usage (for analytics)
 */
export async function trackTemplateUsage(req, res, next) {
  try {
    const { templateId } = req.params;

    // ✅ Security: Get storeId from context (preferred) or fallback to req.shop
    let shopId = null;
    try {
      shopId = getStoreId(req); // ✅ Use store context if available
    } catch (error) {
      // Fallback for legacy support
      shopId = req.shop?.shopId || req.shop?.id;
    }

    if (!shopId) {
      throw new ValidationError(
        'Shop context is required to track template usage. Please ensure you are properly authenticated.',
      );
    }

    // Check if template exists and is public
    const template = await prisma.template.findFirst({
      where: {
        id: templateId,
        isPublic: true,
      },
    });

    if (!template) {
      throw new NotFoundError('Template');
    }

    // Upsert template usage record
    await prisma.templateUsage.upsert({
      where: {
        shopId_templateId: {
          shopId,
          templateId,
        },
      },
      update: {
        usedCount: { increment: 1 },
        lastUsedAt: new Date(),
      },
      create: {
        shopId,
        templateId,
        usedCount: 1,
        lastUsedAt: new Date(),
      },
    });

    return sendSuccess(res, null, 'Template usage tracked');
  } catch (error) {
    logger.error('Failed to track template usage', {
      error: error.message,
      stack: error.stack,
      templateId: req.params.templateId,
      shopId: req.shop?.id,
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    next(error);
  }
}

/**
 * Ensure default templates exist for shop and eShop type
 * Idempotent endpoint that creates missing templates and repairs existing ones
 * POST /api/templates/ensure-defaults?eshopType=...
 */
export async function ensureDefaultTemplates(req, res, next) {
  try {
    const shopId = getStoreId(req);
    const { eshopType } = req.query;

    // Validate eshopType
    if (!eshopType) {
      return res.status(400).json({
        success: false,
        error: 'VALIDATION_ERROR',
        message: 'eshopType query parameter is required',
      });
    }

    // Call service to ensure defaults
    const result = await templatesService.ensureDefaultTemplates(shopId, eshopType);

    logger.info('Default templates ensured', {
      shopId,
      eshopType,
      result,
    });

    return sendSuccess(res, {
      ...result,
      message: `Default templates ensured for ${eshopType} (English-only)`,
    }, 'Default templates ensured');
  } catch (error) {
    logger.error('Failed to ensure default templates', {
      error: error.message,
      stack: error.stack,
      shopId: getStoreId(req),
      eshopType: req.query.eshopType,
      requestId: req.id,
      path: req.path,
      method: req.method,
    });
    next(error);
  }
}

export default {
  getAllTemplates,
  getTemplateById,
  getTemplateCategories,
  trackTemplateUsage,
  ensureDefaultTemplates,
};
