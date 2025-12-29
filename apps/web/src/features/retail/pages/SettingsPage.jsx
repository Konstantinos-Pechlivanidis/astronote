import { useState } from 'react';
import { useRetailSettings, useUpdateRetailSettings } from '../hooks/useRetailSettings';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import { useSelector, useDispatch } from 'react-redux';
import { setRetailToken } from '@/store/authSlice';

export default function RetailSettingsPage() {
  const { data: settings, isLoading, error, refetch } = useRetailSettings();
  const updateSettings = useUpdateRetailSettings();
  const token = useSelector((state) => state.auth.retailToken);
  const dispatch = useDispatch();
  const [tokenInput, setTokenInput] = useState('');
  const [settingsForm, setSettingsForm] = useState({});

  const handleSaveToken = () => {
    if (tokenInput) {
      dispatch(setRetailToken(tokenInput));
      setTokenInput('');
    }
  };

  const handleSaveSettings = () => {
    if (settings && Object.keys(settingsForm).length > 0) {
      updateSettings.mutate(settingsForm);
    }
  };

  if (isLoading) {
    return <LoadingBlock message="Loading settings..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load settings"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader title="Settings" description="Manage your account settings" />

      <div className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Authentication</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">API Token</label>
              <div className="flex gap-2">
                <Input
                  type="password"
                  value={tokenInput}
                  onChange={(e) => setTokenInput(e.target.value)}
                  placeholder="Enter API token"
                  className="flex-1"
                />
                <Button onClick={handleSaveToken}>Save Token</Button>
              </div>
              {token && (
                <p className="text-xs text-gray-500 mt-2">
                  Token is set (hidden for security)
                </p>
              )}
            </div>
          </CardContent>
        </Card>

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

