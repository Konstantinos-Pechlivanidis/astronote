'use client';

import { GlassCard } from '@/components/ui/glass-card';
import { Navbar } from '@/components/layout/navbar';
import { Footer } from '@/components/layout/footer';

// API endpoints map - single source of truth
const API_MAP = {
  retail: {
    baseUrl: 'NEXT_PUBLIC_RETAIL_API_BASE_URL',
    auth: {
      register: { method: 'POST', path: '/api/auth/register', file: 'apps/retail-api/apps/api/src/routes/auth.js' },
      login: { method: 'POST', path: '/api/auth/login', file: 'apps/retail-api/apps/api/src/routes/auth.js' },
      refresh: { method: 'POST', path: '/api/auth/refresh', file: 'apps/retail-api/apps/api/src/routes/auth.js' },
      logout: { method: 'POST', path: '/api/auth/logout', file: 'apps/retail-api/apps/api/src/routes/auth.js' },
    },
    billing: {
      balance: { method: 'GET', path: '/api/billing/balance', file: 'apps/retail-api/apps/api/src/routes/billing.js' },
      packages: { method: 'GET', path: '/api/billing/packages', file: 'apps/retail-api/apps/api/src/routes/billing.js' },
      transactions: { method: 'GET', path: '/api/billing/transactions', file: 'apps/retail-api/apps/api/src/routes/billing.js' },
      purchase: { method: 'POST', path: '/api/billing/purchase', file: 'apps/retail-api/apps/api/src/routes/billing.js' },
      topup: { method: 'POST', path: '/api/billing/topup', file: 'apps/retail-api/apps/api/src/routes/billing.js' },
    },
    subscriptions: {
      current: { method: 'GET', path: '/api/subscriptions/current', file: 'apps/retail-api/apps/api/src/routes/subscriptions.js' },
      subscribe: { method: 'POST', path: '/api/subscriptions/subscribe', file: 'apps/retail-api/apps/api/src/routes/subscriptions.js', body: '{ planType: "starter" | "pro" }' },
      cancel: { method: 'POST', path: '/api/subscriptions/cancel', file: 'apps/retail-api/apps/api/src/routes/subscriptions.js' },
    },
    dashboard: {
      kpis: { method: 'GET', path: '/api/dashboard/kpis', file: 'apps/retail-api/apps/api/src/routes/dashboard.js' },
    },
  },
  shopify: {
    baseUrl: 'NEXT_PUBLIC_SHOPIFY_API_BASE_URL',
    auth: {
      tokenExchange: { method: 'POST', path: '/auth/shopify-token', file: 'apps/shopify-api/routes/auth.js', body: '{ sessionToken: string }' },
      oauth: { method: 'GET', path: '/auth/shopify', file: 'apps/shopify-api/routes/auth.js', params: '?shop=domain' },
      callback: { method: 'GET', path: '/auth/callback', file: 'apps/shopify-api/routes/auth.js' },
    },
    billing: {
      balance: { method: 'GET', path: '/billing/balance', file: 'apps/shopify-api/routes/billing.js' },
      packages: { method: 'GET', path: '/billing/packages', file: 'apps/shopify-api/routes/billing.js' },
      history: { method: 'GET', path: '/billing/history', file: 'apps/shopify-api/routes/billing.js' },
      purchase: { method: 'POST', path: '/billing/purchase', file: 'apps/shopify-api/routes/billing.js', body: '{ packageId: string }' },
      topup: { method: 'POST', path: '/billing/topup', file: 'apps/shopify-api/routes/billing.js', body: '{ credits: number }' },
    },
    subscriptions: {
      status: { method: 'GET', path: '/subscriptions/status', file: 'apps/shopify-api/routes/subscriptions.js' },
      subscribe: { method: 'POST', path: '/subscriptions/subscribe', file: 'apps/shopify-api/routes/subscriptions.js', body: '{ planType: "starter" | "pro" }' },
      cancel: { method: 'POST', path: '/subscriptions/cancel', file: 'apps/shopify-api/routes/subscriptions.js' },
      portal: { method: 'GET', path: '/subscriptions/portal', file: 'apps/shopify-api/routes/subscriptions.js' },
    },
    dashboard: {
      overview: { method: 'GET', path: '/dashboard', file: 'apps/shopify-api/routes/dashboard.js' },
    },
  },
};

export default function ApiMapPage() {
  return (
    <div className="min-h-screen flex flex-col">
      <Navbar />

      <main className="flex-1 pt-24 pb-20 px-4 sm:px-6 lg:px-8">
        <div className="max-w-6xl mx-auto">
          <div className="mb-8">
            <h1 className="text-4xl font-bold mb-4">API Endpoints Map</h1>
            <p className="text-text-secondary">
              Complete mapping of frontend API calls to backend endpoints. This page is for development reference only.
            </p>
          </div>

          {/* Retail API */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Retail API</h2>
            <p className="text-text-secondary mb-4 text-sm">
              Base URL: <code className="bg-surface px-2 py-1 rounded">{API_MAP.retail.baseUrl}</code>
            </p>

            {Object.entries(API_MAP.retail).filter(([key]) => key !== 'baseUrl').map(([category, endpoints]) => (
              <GlassCard key={category} className="mb-6">
                <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
                <div className="space-y-4">
                  {Object.entries(endpoints as any).map(([name, endpoint]: [string, any]) => (
                    <div key={name} className="border-l-2 border-accent pl-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-mono text-sm font-semibold text-text-primary">
                            {endpoint.method} {endpoint.path}
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">
                            File: <code>{endpoint.file}</code>
                          </div>
                          {endpoint.body && (
                            <div className="text-xs text-text-secondary mt-1">
                              Body: <code>{endpoint.body}</code>
                            </div>
                          )}
                          {endpoint.params && (
                            <div className="text-xs text-text-secondary mt-1">
                              Params: <code>{endpoint.params}</code>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-text-tertiary">
                          {name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Shopify API */}
          <div className="mb-12">
            <h2 className="text-2xl font-semibold mb-4">Shopify API</h2>
            <p className="text-text-secondary mb-4 text-sm">
              Base URL: <code className="bg-surface px-2 py-1 rounded">{API_MAP.shopify.baseUrl}</code>
            </p>

            {Object.entries(API_MAP.shopify).filter(([key]) => key !== 'baseUrl').map(([category, endpoints]) => (
              <GlassCard key={category} className="mb-6">
                <h3 className="text-lg font-semibold mb-4 capitalize">{category}</h3>
                <div className="space-y-4">
                  {Object.entries(endpoints as any).map(([name, endpoint]: [string, any]) => (
                    <div key={name} className="border-l-2 border-accent pl-4">
                      <div className="flex items-start justify-between mb-2">
                        <div>
                          <div className="font-mono text-sm font-semibold text-text-primary">
                            {endpoint.method} {endpoint.path}
                          </div>
                          <div className="text-xs text-text-tertiary mt-1">
                            File: <code>{endpoint.file}</code>
                          </div>
                          {endpoint.body && (
                            <div className="text-xs text-text-secondary mt-1">
                              Body: <code>{endpoint.body}</code>
                            </div>
                          )}
                          {endpoint.params && (
                            <div className="text-xs text-text-secondary mt-1">
                              Params: <code>{endpoint.params}</code>
                            </div>
                          )}
                        </div>
                        <div className="text-xs text-text-tertiary">
                          {name}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </GlassCard>
            ))}
          </div>

          {/* Pricing Constants */}
          <GlassCard>
            <h2 className="text-2xl font-semibold mb-4">Pricing Constants</h2>
            <div className="space-y-4 text-sm">
              <div>
                <strong className="text-text-primary">Monthly Plan (Starter):</strong>
                <ul className="list-disc list-inside ml-4 mt-1 text-text-secondary">
                  <li>Plan Type: <code>&quot;starter&quot;</code></li>
                  <li>Price: €40/month</li>
                  <li>Free Credits: 100 per billing cycle</li>
                  <li>Stripe Price ID Env: <code>STRIPE_PRICE_ID_SUB_STARTER_EUR</code></li>
                </ul>
              </div>
              <div>
                <strong className="text-text-primary">Yearly Plan (Pro):</strong>
                <ul className="list-disc list-inside ml-4 mt-1 text-text-secondary">
                  <li>Plan Type: <code>&quot;pro&quot;</code></li>
                  <li>Price: €240/year (€20/month effective)</li>
                  <li>Free Credits: 500 per billing cycle</li>
                  <li>Stripe Price ID Env: <code>STRIPE_PRICE_ID_SUB_PRO_EUR</code></li>
                </ul>
              </div>
              <div>
                <strong className="text-text-primary">Credit Pricing:</strong>
                <ul className="list-disc list-inside ml-4 mt-1 text-text-secondary">
                  <li>Default cost per credit: €0.045</li>
                  <li>Credit packs available after subscription</li>
                  <li>Credits never expire</li>
                </ul>
              </div>
            </div>
          </GlassCard>
        </div>
      </main>

      <Footer />
    </div>
  );
}

