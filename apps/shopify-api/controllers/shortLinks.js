import {
  getShortLinkByToken,
  incrementClickCount,
} from '../services/shortLinks.js';
import { logger } from '../utils/logger.js';
import { getFrontendBaseUrlSync } from '../utils/frontendUrl.js';

/**
 * Redirect handler for short links
 * GET /r/:token
 * Public endpoint (no authentication required)
 */
export async function redirectShortLink(req, res) {
  const { token } = req.params;

  if (!token || typeof token !== 'string') {
    return res.status(400).json({
      success: false,
      error: 'invalid_token',
      message: 'Invalid token format',
    });
  }

  try {
    // Get short link from database
    const shortLink = await getShortLinkByToken(token);

    if (!shortLink) {
      logger.warn('Short link not found', { token });
      // Redirect to frontend with error message
      const frontendUrl = getFrontendBaseUrlSync();
      return res.redirect(
        `${frontendUrl}/error?message=${encodeURIComponent('Link not found')}`,
      );
    }

    // Check if expired
    if (shortLink.expiresAt && new Date(shortLink.expiresAt) < new Date()) {
      logger.info('Short link expired', { token, expiresAt: shortLink.expiresAt });
      // Redirect to frontend with error message
      const frontendUrl = getFrontendBaseUrlSync();
      return res.status(410).redirect(
        `${frontendUrl}/error?message=${encodeURIComponent('Link has expired')}`,
      );
    }

    // Validate destination URL (security check)
    try {
      const urlObj = new URL(shortLink.destinationUrl);
      // Protocol validation
      if (urlObj.protocol !== 'https:' && urlObj.protocol !== 'http:') {
        logger.error('Invalid destination URL protocol', {
          token,
          destinationUrl: shortLink.destinationUrl,
        });
        return res.status(400).json({
          success: false,
          error: 'invalid_destination',
          message: 'Invalid destination URL',
        });
      }

      // In production, only allow HTTPS
      if (process.env.NODE_ENV === 'production' && urlObj.protocol !== 'https:') {
        logger.error('HTTP not allowed in production', {
          token,
          destinationUrl: shortLink.destinationUrl,
        });
        return res.status(400).json({
          success: false,
          error: 'invalid_destination',
          message: 'HTTPS required in production',
        });
      }

      // Optional hostname allowlist
      const allowedHosts = process.env.REDIRECT_ALLOWED_HOSTS;
      if (allowedHosts) {
        const hosts = allowedHosts.split(',').map(h => h.trim());
        const hostname = urlObj.hostname;
        let isAllowed = false;

        for (const pattern of hosts) {
          // Remove protocol if present
          const cleanPattern = pattern.replace(/^https?:\/\//, '').replace(/\/$/, '');
          // Support wildcards like *.myshopify.com
          if (cleanPattern.startsWith('*.')) {
            const domain = cleanPattern.substring(2);
            if (hostname.endsWith(`.${domain}`) || hostname === domain) {
              isAllowed = true;
              break;
            }
          } else if (hostname === cleanPattern) {
            isAllowed = true;
            break;
          }
        }

        if (!isAllowed) {
          logger.warn('Destination hostname not in allowlist', {
            token,
            hostname,
            allowedHosts,
          });
          return res.status(400).json({
            success: false,
            error: 'invalid_destination',
            message: 'Destination hostname not allowed',
          });
        }
      }
    } catch (urlError) {
      logger.error('Invalid destination URL format', {
        token,
        destinationUrl: shortLink.destinationUrl,
        error: urlError.message,
      });
      return res.status(400).json({
        success: false,
        error: 'invalid_destination',
        message: 'Invalid destination URL format',
      });
    }

    // Increment click count (atomic update)
    await incrementClickCount(token);

    // Log click (redact query params for privacy)
    const destinationForLog = shortLink.destinationUrl.split('?')[0];
    logger.info('Short link clicked', {
      token,
      shopId: shortLink.shopId,
      campaignId: shortLink.campaignId,
      destination: destinationForLog,
      clicks: shortLink.clicks + 1,
    });

    // Redirect to destination
    res.redirect(302, shortLink.destinationUrl);
  } catch (error) {
    logger.error('Error handling short link redirect', {
      token,
      error: error.message,
      stack: error.stack,
    });

    // Redirect to frontend with error message
    const frontendUrl = getFrontendBaseUrlSync();
    res.redirect(
      `${frontendUrl}/error?message=${encodeURIComponent('An error occurred')}`,
    );
  }
}

