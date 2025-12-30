import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/layout/AppShell';
import LandingPage from '@/features/marketing/pages/LandingPage';

// Retail imports - using migrated retail-web-legacy
import { AuthGuard, PublicOnlyGuard } from '@/retail/app/router/guards';
import RetailAppShell from '@/retail/components/common/AppShell';
import RetailErrorBoundary from '@/retail/app/components/ErrorBoundary';
import RetailLandingPage from '@/retail/features/auth/pages/LandingPage';
import RetailSignupPage from '@/retail/features/auth/pages/SignupPage';
import RetailLoginPage from '@/retail/features/auth/pages/LoginPage';
import RetailDashboardPage from '@/retail/features/dashboard/pages/DashboardPage';
import RetailCampaignsPage from '@/retail/features/campaigns/pages/CampaignsPage';
import RetailNewCampaignPage from '@/retail/features/campaigns/pages/NewCampaignPage';
import RetailCampaignDetailPage from '@/retail/features/campaigns/pages/CampaignDetailPage';
import RetailCampaignStatusPage from '@/retail/features/campaigns/pages/CampaignStatusPage';
import RetailCampaignStatsPage from '@/retail/features/campaigns/pages/CampaignStatsPage';
import RetailEditCampaignPage from '@/retail/features/campaigns/pages/EditCampaignPage';
import RetailContactsPage from '@/retail/features/contacts/pages/ContactsPage';
import RetailContactsImportPage from '@/retail/features/contacts/pages/ContactsImportPage';
import RetailTemplatesPage from '@/retail/features/templates/pages/TemplatesPage';
import RetailBillingPage from '@/retail/features/billing/pages/BillingPage';
import RetailBillingSuccessPage from '@/retail/features/billing/pages/BillingSuccessPage';
import RetailAutomationsPage from '@/retail/features/automations/pages/AutomationsPage';
import RetailSettingsPage from '@/retail/features/settings/pages/SettingsPage';
import RetailNotFoundPage from '@/retail/features/public/pages/NotFoundPage';
import RetailOfferPage from '@/retail/features/public/pages/OfferPage';
import RetailUnsubscribePage from '@/retail/features/public/pages/UnsubscribePage';
import RetailResubscribePage from '@/retail/features/public/pages/ResubscribePage';
import RetailNfcOptInPage from '@/retail/features/public/pages/NfcOptInPage';
import RetailConversionTagPage from '@/retail/features/public/pages/ConversionTagPage';
import RetailLinkExpiredPage from '@/retail/features/public/pages/LinkExpiredPage';

// Shopify imports (keep existing)
import ShopifyLoginPage from '@/features/shopify/pages/LoginPage';
import ShopifyDashboardPage from '@/features/shopify/pages/DashboardPage';
import ShopifyCampaignsPage from '@/features/shopify/pages/CampaignsPage';
import ShopifyCreateCampaignPage from '@/features/shopify/pages/CreateCampaignPage';
import ShopifyContactsPage from '@/features/shopify/pages/ContactsPage';
import ShopifyListsPage from '@/features/shopify/pages/ListsPage';
import ShopifyAutomationsPage from '@/features/shopify/pages/AutomationsPage';
import ShopifyTemplatesPage from '@/features/shopify/pages/TemplatesPage';
import ShopifySettingsPage from '@/features/shopify/pages/SettingsPage';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <LandingPage />,
  },
  // Retail routes
  {
    path: '/retail',
    element: <RetailErrorBoundary />,
    children: [
      // Public auth routes
      {
        path: 'login',
        element: (
          <PublicOnlyGuard>
            <RetailLoginPage />
          </PublicOnlyGuard>
        ),
      },
      {
        path: 'signup',
        element: (
          <PublicOnlyGuard>
            <RetailSignupPage />
          </PublicOnlyGuard>
        ),
      },
      {
        path: 'register',
        element: (
          <PublicOnlyGuard>
            <RetailSignupPage />
          </PublicOnlyGuard>
        ),
      },
      {
        path: 'landing',
        element: (
          <PublicOnlyGuard>
            <RetailLandingPage />
          </PublicOnlyGuard>
        ),
      },
      // Public flows (no auth required)
      {
        path: 'o/:trackingId',
        element: <RetailOfferPage />,
      },
      {
        path: 'unsubscribe',
        element: <RetailUnsubscribePage />,
      },
      {
        path: 'resubscribe',
        element: <RetailResubscribePage />,
      },
      {
        path: 'nfc/:publicId',
        element: <RetailNfcOptInPage />,
      },
      {
        path: 'c/:tagPublicId',
        element: <RetailConversionTagPage />,
      },
      {
        path: 'link-expired',
        element: <RetailLinkExpiredPage />,
      },
      // Protected routes with AppShell
      {
        path: '',
        element: (
          <AuthGuard>
            <RetailAppShell />
          </AuthGuard>
        ),
        children: [
          {
            index: true,
            element: <Navigate to="/retail/dashboard" replace />,
          },
          {
            path: 'dashboard',
            element: <RetailDashboardPage />,
          },
          {
            path: 'campaigns',
            element: <RetailCampaignsPage />,
          },
          {
            path: 'campaigns/new',
            element: <RetailNewCampaignPage />,
          },
          {
            path: 'campaigns/:id',
            element: <RetailCampaignDetailPage />,
          },
          {
            path: 'campaigns/:id/edit',
            element: <RetailEditCampaignPage />,
          },
          {
            path: 'campaigns/:id/status',
            element: <RetailCampaignStatusPage />,
          },
          {
            path: 'campaigns/:id/stats',
            element: <RetailCampaignStatsPage />,
          },
          {
            path: 'contacts',
            element: <RetailContactsPage />,
          },
          {
            path: 'contacts/import',
            element: <RetailContactsImportPage />,
          },
          {
            path: 'templates',
            element: <RetailTemplatesPage />,
          },
          {
            path: 'billing',
            element: <RetailBillingPage />,
          },
          {
            path: 'billing/success',
            element: <RetailBillingSuccessPage />,
          },
          {
            path: 'automations',
            element: <RetailAutomationsPage />,
          },
          {
            path: 'settings',
            element: <RetailSettingsPage />,
          },
        ],
      },
      // 404
      {
        path: '404',
        element: <RetailNotFoundPage />,
      },
    ],
  },
  // Shopify routes (keep existing structure)
  {
    element: <AppShell />,
    children: [
      {
        path: 'shopify',
        children: [
          {
            index: true,
            element: <Navigate to="/shopify/dashboard" replace />,
          },
          {
            path: 'login',
            element: <ShopifyLoginPage />,
          },
          {
            path: 'dashboard',
            element: <ShopifyDashboardPage />,
          },
          {
            path: 'campaigns',
            element: <ShopifyCampaignsPage />,
          },
          {
            path: 'campaigns/new',
            element: <ShopifyCreateCampaignPage />,
          },
          {
            path: 'contacts',
            element: <ShopifyContactsPage />,
          },
          {
            path: 'lists',
            element: <ShopifyListsPage />,
          },
          {
            path: 'automations',
            element: <ShopifyAutomationsPage />,
          },
          {
            path: 'templates',
            element: <ShopifyTemplatesPage />,
          },
          {
            path: 'settings',
            element: <ShopifySettingsPage />,
          },
        ],
      },
    ],
  },
  // Legacy public routes (redirect to retail namespace)
  {
    path: '/o/:trackingId',
    element: <RetailOfferPage />,
  },
  {
    path: '/unsubscribe',
    element: <RetailUnsubscribePage />,
  },
  {
    path: '/resubscribe',
    element: <RetailResubscribePage />,
  },
  {
    path: '/nfc/:publicId',
    element: <RetailNfcOptInPage />,
  },
  {
    path: '/c/:tagPublicId',
    element: <RetailConversionTagPage />,
  },
  {
    path: '/link-expired',
    element: <RetailLinkExpiredPage />,
  },
  // Catch all - show 404
  {
    path: '*',
    element: <RetailNotFoundPage />,
  },
]);
