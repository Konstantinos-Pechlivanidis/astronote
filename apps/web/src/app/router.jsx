import { createBrowserRouter, Navigate } from 'react-router-dom';
import AppShell from '@/layout/AppShell';
import LandingPage from '@/features/marketing/pages/LandingPage';
import RetailLoginPage from '@/features/retail/pages/LoginPage';
import ShopifyLoginPage from '@/features/shopify/pages/LoginPage';

// Import retail pages
import RetailDashboardPage from '@/features/retail/pages/DashboardPage';
import RetailCampaignsPage from '@/features/retail/pages/CampaignsPage';
import RetailCreateCampaignPage from '@/features/retail/pages/CreateCampaignPage';
import RetailContactsPage from '@/features/retail/pages/ContactsPage';
import RetailListsPage from '@/features/retail/pages/ListsPage';
import RetailAutomationsPage from '@/features/retail/pages/AutomationsPage';
import RetailTemplatesPage from '@/features/retail/pages/TemplatesPage';
import RetailSettingsPage from '@/features/retail/pages/SettingsPage';

// Import shopify pages
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
  {
    element: <AppShell />,
    children: [
      // Retail routes
      {
        path: 'retail',
        children: [
          {
            index: true,
            element: <Navigate to="/retail/dashboard" replace />,
          },
          {
            path: 'login',
            element: <RetailLoginPage />,
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
            element: <RetailCreateCampaignPage />,
          },
          {
            path: 'contacts',
            element: <RetailContactsPage />,
          },
          {
            path: 'lists',
            element: <RetailListsPage />,
          },
          {
            path: 'automations',
            element: <RetailAutomationsPage />,
          },
          {
            path: 'templates',
            element: <RetailTemplatesPage />,
          },
          {
            path: 'settings',
            element: <RetailSettingsPage />,
          },
        ],
      },
      // Shopify routes
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
]);
