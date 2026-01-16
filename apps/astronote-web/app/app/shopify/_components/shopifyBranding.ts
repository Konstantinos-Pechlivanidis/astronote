export function shouldHideShopifyLogo(pathname: string) {
  const p = pathname || '';

  // Hide branding only on the specific Shopify routes requested.
  if (p === '/app/shopify/campaigns/new') return true; // Create Campaign
  if (p.startsWith('/app/shopify/settings')) return true;
  if (p.startsWith('/app/shopify/automations')) return true;
  if (p.startsWith('/app/shopify/templates')) return true;

  return false;
}

