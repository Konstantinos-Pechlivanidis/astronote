import { useState } from 'react';
import { useShopifyAutomations, useToggleShopifyAutomation, useUpdateShopifyAutomation } from '@/features/shopify/hooks/useShopifyAutomations';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { formatDate } from '@/utils/formatters';
import { Edit, Power } from 'lucide-react';

export default function ShopifyAutomationsPage() {
  const [editDialog, setEditDialog] = useState({ open: false, automation: null });
  const [editMessage, setEditMessage] = useState('');
  const { data, isLoading, error, refetch } = useShopifyAutomations();
  const toggleAutomation = useToggleShopifyAutomation();
  const updateAutomation = useUpdateShopifyAutomation();

  const automations = data?.automations || data?.data?.automations || [];

  const handleToggle = (id, currentActive) => {
    toggleAutomation.mutate({ id, active: !currentActive });
  };

  const handleEdit = (automation) => {
    setEditDialog({ open: true, automation });
    setEditMessage(automation.message || '');
  };

  const handleSaveEdit = () => {
    if (editDialog.automation) {
      updateAutomation.mutate({
        id: editDialog.automation.id,
        message: editMessage,
      });
      setEditDialog({ open: false, automation: null });
    }
  };

  if (isLoading) {
    return <LoadingBlock message="Loading Shopify automations..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load Shopify automations"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Shopify Automations"
        description="Manage automated SMS triggers for Shopify"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {automations.length === 0 ? (
          <EmptyState
            title="No Shopify automations configured"
            description="Set up automated SMS triggers for your Shopify campaigns"
          />
        ) : (
          automations.map((automation) => (
            <Card key={automation.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{automation.name || automation.triggerType}</CardTitle>
                  <Badge variant={automation.active ? 'default' : 'secondary'}>
                    {automation.active ? 'Active' : 'Inactive'}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <p className="text-sm text-gray-600 mb-1">Trigger:</p>
                  <p className="font-medium">{automation.triggerType}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600 mb-1">Message:</p>
                  <p className="text-sm">{automation.message || 'No message set'}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t">
                  <span className="text-xs text-gray-500">
                    Created: {formatDate(automation.createdAt)}
                  </span>
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleEdit(automation)}
                    >
                      <Edit className="h-4 w-4 mr-1" />
                      Edit
                    </Button>
                    <Button
                      size="sm"
                      variant={automation.active ? 'destructive' : 'default'}
                      onClick={() => handleToggle(automation.id, automation.active)}
                    >
                      <Power className="h-4 w-4 mr-1" />
                      {automation.active ? 'Deactivate' : 'Activate'}
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      {/* Edit Dialog */}
      <Dialog open={editDialog.open} onOpenChange={(open) => setEditDialog({ open, automation: null })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Shopify Automation Message</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <Textarea
                value={editMessage}
                onChange={(e) => setEditMessage(e.target.value)}
                rows={6}
                placeholder="Enter automation message..."
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditDialog({ open: false, automation: null })}>
              Cancel
            </Button>
            <Button onClick={handleSaveEdit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

