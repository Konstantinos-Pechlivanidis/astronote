import { useShopifySegments } from '@/features/shopify/hooks/useShopifySegments';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import PageHeader from '@/components/common/PageHeader';
import { formatNumber } from '@/utils/formatters';

import LoadingBlock from '@/components/common/LoadingBlock';
import ErrorState from '@/components/common/ErrorState';

export default function ListsPage() {
  const { data, isLoading, error, refetch } = useShopifySegments();
  const segments = data?.segments || data?.data?.segments || [];

  // Group segments by type
  const genderSegments = segments.filter(s => s.type === 'system' && s.key?.startsWith('gender_'));
  const ageSegments = segments.filter(s => s.type === 'system' && s.key?.startsWith('age_'));
  const customSegments = segments.filter(s => s.type === 'custom');

  if (isLoading) {
    return <LoadingBlock message="Loading segments..." />;
  }

  if (error) {
    return (
      <ErrorState
        title="Failed to load segments"
        message={error.response?.data?.message || error.message}
        onRetry={refetch}
      />
    );
  }

  return (
    <div>
      <PageHeader
        title="Lists & Segments"
        description="Predefined audience segments for targeting"
      />

      {/* Gender Segments */}
      {genderSegments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Gender Segments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {genderSegments.map((segment) => (
              <Card key={segment.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {segment.criteriaJson?.gender
                        ? `Gender: ${segment.criteriaJson.gender === 'male' ? 'Male' : segment.criteriaJson.gender === 'female' ? 'Female' : 'Unknown'}`
                        : 'System segment'}
                    </p>
                    {segment.estimatedCount !== undefined && (
                      <p className="text-sm font-medium">
                        {formatNumber(segment.estimatedCount)} contacts
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Age Segments */}
      {ageSegments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Age Segments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {ageSegments.map((segment) => (
              <Card key={segment.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    <p className="text-sm text-gray-600">
                      {segment.criteriaJson?.age
                        ? `Age: ${segment.criteriaJson.age.gte || ''}${segment.criteriaJson.age.gte && segment.criteriaJson.age.lte ? '-' : ''}${segment.criteriaJson.age.lte || segment.criteriaJson.age.gte ? '+' : ''}`
                        : 'System segment'}
                    </p>
                    {segment.estimatedCount !== undefined && (
                      <p className="text-sm font-medium">
                        {formatNumber(segment.estimatedCount)} contacts
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Custom Segments */}
      {customSegments.length > 0 && (
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-4">Custom Segments</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {customSegments.map((segment) => (
              <Card key={segment.id}>
                <CardHeader>
                  <CardTitle className="text-lg">{segment.name}</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-2">
                    {segment.estimatedCount !== undefined && (
                      <p className="text-sm font-medium">
                        {formatNumber(segment.estimatedCount)} contacts
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {segments.length === 0 && (
        <Card>
          <CardContent className="py-8 text-center text-gray-500">
            No segments available. System segments will be created automatically.
          </CardContent>
        </Card>
      )}
    </div>
  );
}

