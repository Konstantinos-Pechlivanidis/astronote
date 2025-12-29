import { useState } from 'react';
import { useShopifySettings, useUpdateShopifySettings } from '@/features/shopify/hooks/useShopifySettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import { useSelector, useDispatch } from 'react-redux';
import { setShopifyToken } from '@/store/authSlice';

export default function ShopifySettingsPage() {
  const { data: settings, isLoading, error, refetch } = useShopifySettings();
  const updateSettings = useUpdateShopifySettings();
  const shopifyToken = useSelector((state) => state.auth.shopifyToken);
  const dispatch = useDispatch();
  const [tokenInput, setTokenInput] = useState('');
  const [settingsForm, setSettingsForm] = useState({});

  const handleSaveToken = () => {
    if (tokenInput) {
      dispatch(setShopifyToken(tokenInput));
      setTokenInput('');
    }
  };

  const handleSaveSettings = () => {
    if (settings && Object.keys(settingsForm).length > 0) {
      updateSettings.mutate(settingsForm);
    }
  };

  if (isLoading) {
    return <LoadingBlock message="Loading Shopify settings..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load Shopify settings"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Shopify Settings" description="Manage your Shopify account settings" />

      <div className="space-y-6">
        {/* Auth Token */}
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Shopify API Token</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter Shopify API token"
                  className="flex-1"
                />
                <Button onClick={handleSaveToken}>Save Token</Button>
              </div>
              {shopifyToken && (
                <p className="text-xs text-gray-500 mt-2">
                  Token is set (hidden for security)
                </p>
              )}
            </div>
          </CardContent>
        </Card>

        {/* App Settings */}
        {settings && (
          <Card>
            <CardHeader>
              <CardTitle>Application Settings</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {Object.entries(settings).map(([key, value]) => (
                  <div key={key}>
                    <label className="block text-sm font-medium mb-2">
                      {key.charAt(0).toUpperCase() + key.slice(1).replace(/([A-Z])/g, ' $1')}
                    </label>
                    <Input
                      value={settingsForm[key] !== undefined ? settingsForm[key] : String(value || '')}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, [key]: e.target.value })
                      }
                      placeholder={String(value || '')}
                    />
                  </div>
                ))}
                {Object.keys(settingsForm).length > 0 && (
                  <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveSettings} disabled={updateSettings.isPending}>
                      {updateSettings.isPending ? 'Saving...' : 'Save Settings'}
                    </Button>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

