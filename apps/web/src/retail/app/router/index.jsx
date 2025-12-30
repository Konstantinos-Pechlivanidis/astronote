import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthGuard, PublicOnlyGuard } from './guards';
import AppShell from '../../components/common/AppShell';
import ErrorBoundary from '../components/ErrorBoundary';
import LandingPage from '../../features/auth/pages/LandingPage';
import SignupPage from '../../features/auth/pages/SignupPage';
import LoginPage from '../../features/auth/pages/LoginPage';
import DashboardPage from '../../features/dashboard/pages/DashboardPage';
import CampaignsPage from '../../features/campaigns/pages/CampaignsPage';
import NewCampaignPage from '../../features/campaigns/pages/NewCampaignPage';
import CampaignDetailPage from '../../features/campaigns/pages/CampaignDetailPage';
import CampaignStatusPage from '../../features/campaigns/pages/CampaignStatusPage';
import CampaignStatsPage from '../../features/campaigns/pages/CampaignStatsPage';
import EditCampaignPage from '../../features/campaigns/pages/EditCampaignPage';
import ContactsPage from '../../features/contacts/pages/ContactsPage';
import ContactsImportPage from '../../features/contacts/pages/ContactsImportPage';
import TemplatesPage from '../../features/templates/pages/TemplatesPage';
import BillingPage from '../../features/billing/pages/BillingPage';
import BillingSuccessPage from '../../features/billing/pages/BillingSuccessPage';
import AutomationsPage from '../../features/automations/pages/AutomationsPage';
import SettingsPage from '../../features/settings/pages/SettingsPage';
import NotFoundPage from '../../features/public/pages/NotFoundPage';
import OfferPage from '../../features/public/pages/OfferPage';
import UnsubscribePage from '../../features/public/pages/UnsubscribePage';
import ResubscribePage from '../../features/public/pages/ResubscribePage';
import NfcOptInPage from '../../features/public/pages/NfcOptInPage';
import ConversionTagPage from '../../features/public/pages/ConversionTagPage';
import LinkExpiredPage from '../../features/public/pages/LinkExpiredPage';

export function AppRouter() {
  return (
    <BrowserRouter>
      <ErrorBoundary>
        <Routes>
          {/* Public routes */}
          <Route
            path="/"
            element={
              <PublicOnlyGuard>
                <LandingPage />
              </PublicOnlyGuard>
            }
          />
          <Route
            path="/signup"
            element={
              <PublicOnlyGuard>
                <SignupPage />
              </PublicOnlyGuard>
            }
          />
          <Route
            path="/login"
            element={
              <PublicOnlyGuard>
                <LoginPage />
              </PublicOnlyGuard>
            }
          />

          {/* Public flows (no auth required) */}
          <Route path="/o/:trackingId" element={<OfferPage />} />
          <Route path="/unsubscribe" element={<UnsubscribePage />} />
          <Route path="/resubscribe" element={<ResubscribePage />} />
          <Route path="/nfc/:publicId" element={<NfcOptInPage />} />
          <Route path="/c/:tagPublicId" element={<ConversionTagPage />} />
          <Route path="/link-expired" element={<LinkExpiredPage />} />

          {/* Protected routes with AppShell */}
          <Route
            path="/app"
            element={
              <AuthGuard>
                <AppShell />
              </AuthGuard>
            }
          >
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="campaigns" element={<CampaignsPage />} />
            <Route path="campaigns/new" element={<NewCampaignPage />} />
            <Route path="campaigns/:id" element={<CampaignDetailPage />} />
            <Route path="campaigns/:id/edit" element={<EditCampaignPage />} />
            <Route path="campaigns/:id/status" element={<CampaignStatusPage />} />
            <Route path="campaigns/:id/stats" element={<CampaignStatsPage />} />
            <Route path="contacts" element={<ContactsPage />} />
            <Route path="contacts/import" element={<ContactsImportPage />} />
            <Route path="templates" element={<TemplatesPage />} />
            <Route path="billing" element={<BillingPage />} />
            <Route path="billing/success" element={<BillingSuccessPage />} />
            <Route path="automations" element={<AutomationsPage />} />
            <Route path="settings" element={<SettingsPage />} />
          </Route>

          {/* 404 - public */}
          <Route path="/404" element={<NotFoundPage />} />

          {/* Catch all - show 404 */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </ErrorBoundary>
    </BrowserRouter>
  );
}

