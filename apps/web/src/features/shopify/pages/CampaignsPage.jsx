import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useShopifyCampaigns, useEnqueueShopifyCampaign, useDeleteShopifyCampaign } from '@/features/shopify/hooks/useShopifyCampaigns';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import DataTable from '@/components/common/DataTable';
import PageHeader from '@/components/common/PageHeader';
import ConfirmDialog from '@/components/common/ConfirmDialog';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import { formatDate, formatNumber } from '@/utils/formatters';
import { Plus, Send, Trash2 } from 'lucide-react';
import { TableRow, TableCell } from '@/components/ui/table';

export default function ShopifyCampaignsPage() {
  const navigate = useNavigate();
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [enqueueDialog, setEnqueueDialog] = useState({ open: false, campaignId: null });
  const [deleteDialog, setDeleteDialog] = useState({ open: false, campaignId: null });

  const { data, isLoading, error, refetch } = useShopifyCampaigns({
    page,
    pageSize: 20,
    search,
    status: statusFilter || undefined,
  });
  const enqueueCampaign = useEnqueueShopifyCampaign();
  const deleteCampaign = useDeleteShopifyCampaign();

  const campaigns = data?.campaigns || data?.data?.campaigns || [];
  const total = data?.total || data?.data?.total || 0;

  const handleEnqueue = () => {
    if (enqueueDialog.campaignId) {
      enqueueCampaign.mutate({ id: enqueueDialog.campaignId });
      setEnqueueDialog({ open: false, campaignId: null });
    }
  };

  const handleDelete = () => {
    if (deleteDialog.campaignId) {
      deleteCampaign.mutate(deleteDialog.campaignId);
      setDeleteDialog({ open: false, campaignId: null });
    }
  };

  const getStatusBadge = (status) => {
    const variants = {
      draft: 'secondary',
      scheduled: 'default',
      sending: 'default',
      sent: 'default',
      failed: 'destructive',
      cancelled: 'secondary',
    };
    return <Badge variant={variants[status] || 'secondary'}>{status}</Badge>;
  };

  if (isLoading) {
    return <LoadingBlock message="Loading Shopify campaigns..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load Shopify campaigns"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  const columns = [
    { key: 'name', label: 'Name' },
    { key: 'status', label: 'Status' },
    { key: 'sent', label: 'Sent' },
    { key: 'delivered', label: 'Delivered' },
    { key: 'created', label: 'Created' },
    { key: 'actions', label: 'Actions', className: 'text-right' },
  ];

  return (
    <div>
      <PageHeader
        title="Shopify Campaigns"
        description="Manage your Shopify SMS campaigns"
        action={() => navigate('/shopify/campaigns/new')}
        actionLabel={
          <>
            <Plus className="h-4 w-4 mr-2" />
            Create Campaign
          </>
        }
      />

      {/* Filters */}
      <div className="mb-4 flex gap-4">
        <Input
          placeholder="Search campaigns..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          className="max-w-sm"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="w-[180px] h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
        >
          <option value="">All statuses</option>
          <option value="draft">Draft</option>
          <option value="scheduled">Scheduled</option>
          <option value="sending">Sending</option>
          <option value="sent">Sent</option>
          <option value="failed">Failed</option>
        </select>
      </div>

      <DataTable
        columns={columns}
        data={campaigns}
        isLoading={isLoading}
        emptyTitle="No Shopify campaigns found"
        emptyDescription="Create your first Shopify campaign to get started"
        emptyAction={() => navigate('/shopify/campaigns/new')}
        emptyActionLabel="Create Campaign"
        page={page}
        pageSize={20}
        total={total}
        onPageChange={setPage}
        renderRow={(campaign) => (
          <TableRow key={campaign.id}>
            <TableCell className="font-medium">{campaign.name}</TableCell>
            <TableCell>{getStatusBadge(campaign.status)}</TableCell>
            <TableCell>{formatNumber(campaign.sentCount || campaign.recipientCount || 0)}</TableCell>
            <TableCell>{formatNumber(campaign.deliveredCount || 0)}</TableCell>
            <TableCell>{formatDate(campaign.createdAt)}</TableCell>
            <TableCell className="text-right">
              <div className="flex items-center justify-end gap-2">
                {['draft', 'scheduled'].includes(campaign.status) && (
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setEnqueueDialog({ open: true, campaignId: campaign.id })}
                    disabled={enqueueCampaign.isPending}
                  >
                    <Send className="h-4 w-4 mr-1" />
                    Send
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => setDeleteDialog({ open: true, campaignId: campaign.id })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        )}
      />

      {/* Enqueue Confirmation Dialog */}
      <ConfirmDialog
        open={enqueueDialog.open}
        onOpenChange={(open) => setEnqueueDialog({ open, campaignId: null })}
        title="Send Campaign"
        description="Are you sure you want to send this campaign? This will enqueue it for immediate sending."
        confirmLabel="Send"
        onConfirm={handleEnqueue}
      />

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog({ open, campaignId: null })}
        title="Delete Campaign"
        description="Are you sure you want to delete this campaign? This action cannot be undone."
        confirmLabel="Delete"
        variant="destructive"
        onConfirm={handleDelete}
      />
    </div>
  );
}

