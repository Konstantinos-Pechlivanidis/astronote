import { useRetailTemplates } from '../hooks/useRetailTemplates';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import PageHeader from '@/components/common/PageHeader';
import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';
import EmptyState from '@/components/common/EmptyState';
import { Copy, Check } from 'lucide-react';
import { useState } from 'react';
import { toast } from 'sonner';

export default function RetailTemplatesPage() {
  const [copiedId, setCopiedId] = useState(null);
  const { data, isLoading, error, refetch } = useRetailTemplates();
  const templates = data?.templates || data?.data?.templates || [];

  const handleCopy = (template) => {
    navigator.clipboard.writeText(template.message || template.content || '');
    setCopiedId(template.id);
    toast.success('Template copied to clipboard');
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (isLoading) {
    return <LoadingBlock message="Loading templates..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load templates"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Templates"
        description="Copy and paste SMS message templates"
      />

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {templates.length === 0 ? (
          <EmptyState
            title="No templates available"
            description="Templates will appear here when available"
          />
        ) : (
          templates.map((template) => (
            <Card key={template.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="text-lg">{template.name || 'Untitled'}</CardTitle>
                  {template.category && (
                    <Badge variant="secondary">{template.category}</Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-gray-700 whitespace-pre-wrap">
                  {template.message || template.content || 'No content'}
                </p>
                <Button
                  className="w-full"
                  variant="outline"
                  onClick={() => handleCopy(template)}
                >
                  {copiedId === template.id ? (
                    <>
                      <Check className="h-4 w-4 mr-2" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-4 w-4 mr-2" />
                      Copy
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          ))
        )}
      </div>
    </div>
  );
}

