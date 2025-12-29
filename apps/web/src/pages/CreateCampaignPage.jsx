import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCreateShopifyCampaign, useEnqueueShopifyCampaign } from '@/features/shopify/hooks/useShopifyCampaigns';
import { useShopifySegments } from '@/features/shopify/hooks/useShopifySegments';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import { AVAILABLE_PLACEHOLDERS } from '@/utils/placeholder';
import { ArrowLeft } from 'lucide-react';

export default function CreateCampaignPage() {
  const navigate = useNavigate();
  const textareaRef = useRef(null);
  const [formData, setFormData] = useState({
    name: '',
    message: '',
    audience: 'all',
    includeDiscount: false,
    discountValue: '',
  });
  const createCampaign = useCreateShopifyCampaign();
  const enqueueCampaign = useEnqueueShopifyCampaign();
  const { data: segmentsData } = useShopifySegments();
  const segments = segmentsData?.segments || segmentsData?.data?.segments || [];
  // Group segments by type
  const genderSegments = segments.filter(s => s.key?.startsWith('gender_'));
  const ageSegments = segments.filter(s => s.key?.startsWith('age_'));

  const handleInsertPlaceholder = (placeholder) => {
    const textarea = textareaRef.current;
    if (textarea) {
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const text = formData.message;
      const before = text.substring(0, start);
      const after = text.substring(end);
      const newText = before + placeholder + after;
      setFormData({ ...formData, message: newText });
      setTimeout(() => {
        textarea.focus();
        textarea.setSelectionRange(start + placeholder.length, start + placeholder.length);
      }, 0);
    }
  };

  const handleSubmit = async (e, sendNow = false) => {
    e.preventDefault();
    try {
      const audienceObj = formData.audience === 'all'
        ? { type: 'all' }
        : { type: 'segment', segmentId: formData.audience };
      const campaignData = {
        name: formData.name,
        message: formData.message,
        audience: audienceObj,
        ...(formData.includeDiscount && formData.discountValue && {
          includeDiscount: true,
          discountValue: formData.discountValue,
        }),
      };
      const result = await createCampaign.mutateAsync(campaignData);
      const campaignId = result?.id || result?.data?.id;
      if (sendNow && campaignId) {
        // Generate idempotency key
        const idempotencyKey = `enqueue-${campaignId}-${Date.now()}`;
        await enqueueCampaign.mutateAsync({ id: campaignId, idempotencyKey });
      }
      navigate('/shopify/campaigns');
    } catch (error) {
      // Error handled by mutation
    }
  };

  return (
    <div>
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" size="icon" onClick={() => navigate('/shopify/campaigns')}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <PageHeader title="Create Campaign" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        <Card>
          <CardHeader>
            <CardTitle>Campaign Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Campaign Name</label>
              <Input
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Summer Sale 2024"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-2">Message</label>
              <Textarea
                ref={textareaRef}
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                placeholder="Enter your message here..."
                rows={6}
                required
              />
              <div className="mt-2 flex flex-wrap gap-2">
                {AVAILABLE_PLACEHOLDERS.map((ph) => (
                  <Button
                    key={ph.key}
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => handleInsertPlaceholder(ph.placeholder)}
                  >
                    {ph.label}
                  </Button>
                ))}
              </div>
            </div>

            <div>
              <label className="flex items-center gap-2 mb-2">
                <input
                  type="checkbox"
                  checked={formData.includeDiscount}
                  onChange={(e) =>
                    setFormData({ ...formData, includeDiscount: e.target.checked })
                  }
                />
                <span className="text-sm font-medium">Include Discount</span>
              </label>
              {formData.includeDiscount && (
                <Input
                  value={formData.discountValue}
                  onChange={(e) =>
                    setFormData({ ...formData, discountValue: e.target.value })
                  }
                  placeholder="SAVE20"
                  className="mt-2"
                />
              )}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-2">Select Audience</label>
              <select
                value={formData.audience}
                onChange={(e) => setFormData({ ...formData, audience: e.target.value })}
                className="w-full h-10 rounded-md border border-input bg-background px-3 py-2 text-sm"
              >
                <option value="all">All Contacts</option>
                {genderSegments.length > 0 && (
                  <optgroup label="Gender">
                    {genderSegments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {ageSegments.length > 0 && (
                  <optgroup label="Age">
                    {ageSegments.map((segment) => (
                      <option key={segment.id} value={segment.id}>
                        {segment.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button type="button" variant="outline" onClick={() => navigate('/shopify/campaigns')}>
            Cancel
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={(e) => handleSubmit(e, true)}
            disabled={createCampaign.isPending || enqueueCampaign.isPending}
          >
            {createCampaign.isPending || enqueueCampaign.isPending
              ? 'Creating & Sending...'
              : 'Create & Send Now'}
          </Button>
          <Button
            type="submit"
            disabled={createCampaign.isPending}
          >
            {createCampaign.isPending ? 'Creating...' : 'Create Campaign'}
          </Button>
        </div>
      </form>
    </div>
  );
}

